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
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { ok: false, error: `That file type isn't allowed here (expected ${allowedTypes.join(", ")}).` };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const record = await prisma.uploadedFile.create({
      data: {
        data: new Uint8Array(arrayBuffer),
        mimeType: file.type || "application/octet-stream",
        originalName: file.name,
      },
    });
    return { ok: true, fileId: record.id, fileName: file.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to store file." };
  }
}
