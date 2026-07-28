"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Generic (non-image) file upload — manuscripts (PDF/EPUB/MOBI) and
 * sample-page excerpts (PDF), which can't go through the image-only
 * WebP-conversion path (see actions/images.ts). Stored as raw bytes in
 * the database (same reasoning as images: no S3/Cloudinary configured),
 * served back out through app/api/files/[id]/route.ts.
 */

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB, matching the manuscript size limit

// Maps each accepted MIME type to its real file extension(s), so a file
// can be validated by extension when the browser/OS reports an empty or
// nonstandard MIME type for it — a common real-world cause of "PDF
// upload doesn't work" (some Windows file-association setups, or files
// with no recognized extension mapping, report file.type as "" for a
// perfectly valid PDF). Requiring an exact MIME match with no fallback
// was rejecting those genuinely valid uploads outright.
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/epub+zip": [".epub"],
  "application/x-mobipocket-ebook": [".mobi"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

function hasAllowedExtension(fileName: string, allowedTypes: string[]): boolean {
  const lower = fileName.toLowerCase();
  return allowedTypes.some((mime) => (MIME_TO_EXTENSIONS[mime] ?? []).some((ext) => lower.endsWith(ext)));
}

export interface UploadFileResult {
  ok: boolean;
  fileId?: string;
  fileName?: string;
  error?: string;
}

export async function uploadGenericFile(formData: FormData, allowedTypes: string[]): Promise<UploadFileResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "You need to be signed in to upload files." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file was provided." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File is too large (max 50MB)." };
  }
  const mimeOk = allowedTypes.length === 0 || allowedTypes.includes(file.type);
  const extOk = hasAllowedExtension(file.name, allowedTypes);
  if (allowedTypes.length > 0 && !mimeOk && !extOk) {
    return { ok: false, error: `That file type isn't allowed here (expected ${allowedTypes.join(", ")}).` };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    // Trust the file's real extension for the stored MIME type when the
    // browser didn't report one (or reported something generic) — keeps
    // the served-back file's Content-Type accurate.
    const inferredMime = file.type || (extOk ? Object.entries(MIME_TO_EXTENSIONS).find(([, exts]) => exts.some((e) => file.name.toLowerCase().endsWith(e)))?.[0] : undefined);
    const record = await prisma.uploadedFile.create({
      data: {
        data: new Uint8Array(arrayBuffer),
        mimeType: inferredMime || "application/octet-stream",
        originalName: file.name,
      },
    });
    return { ok: true, fileId: record.id, fileName: file.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to store file." };
  }
}
