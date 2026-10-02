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

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB — see next.config.ts for why this ceiling exists

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
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a"],
  "audio/x-m4a": [".m4a"],
  "audio/aac": [".aac"],
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
  /** Page count, auto-detected from the actual uploaded file when it's
   * (or converts to) a PDF — see readPdfMetadata below. Undefined for
   * EPUB/MOBI, where page count isn't a well-defined property of the
   * file itself; the submission form falls back to manual entry then. */
  pageCount?: number;
  /** Trim size of the PDF's first page, e.g. "5.5 x 8.5 in" — auto-
   * detected the same way as pageCount, same EPUB/MOBI caveat. */
  dimensions?: string;
  /** The stored file's actual size in bytes — the real uploaded (or, for
   * a DOCX, converted-to-PDF) file, not an estimate. */
  fileSizeBytes?: number;
  error?: string;
}

/** Best-effort PDF page count + first-page trim size via pdf-lib
 * (already a dependency for the print-fulfillment PDF work — see
 * lib/payments/lulu.ts) — returns an empty object rather than throwing
 * if the bytes can't be parsed, so a slightly malformed upload still
 * succeeds without this metadata rather than failing the whole upload
 * over it. Page size comes back from pdf-lib in PDF points (1/72 inch),
 * converted here to inches to match what the submission form and
 * product page's detail card both expect. */
async function readPdfMetadata(bytes: Uint8Array): Promise<{ pageCount?: number; dimensions?: string }> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(bytes);
    const pageCount = doc.getPageCount();
    let dimensions: string | undefined;
    if (pageCount > 0) {
      const { width, height } = doc.getPage(0).getSize();
      const widthIn = width / 72;
      const heightIn = height / 72;
      dimensions = `${widthIn.toFixed(1)} x ${heightIn.toFixed(1)} in`;
    }
    return { pageCount, dimensions };
  } catch {
    return {};
  }
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
    return { ok: false, error: "File is too large (max 4MB)." };
  }
  const mimeOk = allowedTypes.length === 0 || allowedTypes.includes(file.type);
  const extOk = hasAllowedExtension(file.name, allowedTypes);
  if (allowedTypes.length > 0 && !mimeOk && !extOk) {
    return { ok: false, error: `That file type isn't allowed here (expected ${allowedTypes.join(", ")}).` };
  }

  const isDocx = file.name.toLowerCase().endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  try {
    const arrayBuffer = await file.arrayBuffer();

    if (isDocx) {
      const { convertDocxToPdf } = await import("@/lib/docx-to-pdf");
      const pdfBytes = new Uint8Array(await convertDocxToPdf(Buffer.from(arrayBuffer)));
      const record = await prisma.uploadedFile.create({
        data: {
          data: pdfBytes,
          mimeType: "application/pdf",
          originalName: file.name.replace(/\.docx$/i, ".pdf"),
        },
      });
      const docxMeta = await readPdfMetadata(pdfBytes);
      return { ok: true, fileId: record.id, fileName: record.originalName, fileSizeBytes: pdfBytes.byteLength, ...docxMeta };
    }

    // Trust the file's real extension for the stored MIME type when the
    // browser didn't report one (or reported something generic) — keeps
    // the served-back file's Content-Type accurate.
    const inferredMime = file.type || (extOk ? Object.entries(MIME_TO_EXTENSIONS).find(([, exts]) => exts.some((e) => file.name.toLowerCase().endsWith(e)))?.[0] : undefined);
    const bytes = new Uint8Array(arrayBuffer);
    const record = await prisma.uploadedFile.create({
      data: {
        data: bytes,
        mimeType: inferredMime || "application/octet-stream",
        originalName: file.name,
      },
    });
    const pdfMeta = inferredMime === "application/pdf" ? await readPdfMetadata(bytes) : {};
    return { ok: true, fileId: record.id, fileName: file.name, fileSizeBytes: bytes.byteLength, ...pdfMeta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to store file." };
  }
}
