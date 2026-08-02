"use server";

import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES } from "@/lib/roles";

/**
 * Real image upload — every image is converted to WebP on the way in
 * (smaller files, consistent format across the whole site), stored in
 * the database (no external file storage like S3/Cloudinary is
 * configured for this deployment), and served back out through
 * app/api/images/[id]/route.ts. Used for the logo, payment badges
 * (Site Settings), and book covers (submission form) — anywhere that
 * previously only accepted a pasted image URL.
 */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB — matches the server action body-size limit in next.config.ts

// Common image file extensions, used as a fallback recognition path
// when the browser/OS doesn't report a usable MIME type for the file
// (this happens more often than you'd expect — some OS/browser
// combinations report an empty file.type for less common formats like
// .heic, or even for .png/.jpg in some setups). Sharp can decode all of
// these; if a file passes this check but genuinely isn't a valid image,
// sharp's own processing step below throws a clear error instead.
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".avif", ".heic", ".heif", ".svg"];
const MIME_TO_IMAGE_EXTENSIONS: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
};

export interface UploadImageResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function uploadImage(
  formData: FormData,
  options?: { trim?: boolean; allowedTypes?: string[] }
): Promise<UploadImageResult> {
  try {
    const session = await auth();
    const role = session?.user?.role;
    // Anyone signed in may upload (readers don't need this, but authors
    // submitting book covers do) — actual write permissions for *where* an
    // image gets used are enforced by the action that saves that
    // reference (e.g. only Admin can save a logo URL).
    if (!role) {
      return { ok: false, error: "You need to be signed in to upload images." };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file was provided." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: "Image is too large (max 8MB)." };
    }

    const allowedTypes = options?.allowedTypes;
    let mimeOk: boolean;
    let extOk: boolean;
    const nameLower = file.name.toLowerCase();
    if (allowedTypes && allowedTypes.length > 0) {
      mimeOk = allowedTypes.includes(file.type);
      extOk = allowedTypes.some((mime) => (MIME_TO_IMAGE_EXTENSIONS[mime] ?? []).some((ext) => nameLower.endsWith(ext)));
      if (!mimeOk && !extOk) {
        return { ok: false, error: `Please upload one of: ${allowedTypes.join(", ")}.` };
      }
    } else {
      mimeOk = file.type.startsWith("image/");
      extOk = IMAGE_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
      if (!mimeOk && !extOk) {
        return { ok: false, error: "Please upload an image file." };
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    let pipeline = sharp(Buffer.from(arrayBuffer));
    // For logo/favicon uploads: many logo files (like this one) are
    // exported on a much larger canvas than the actual visible artwork,
    // with wide transparent or solid-color margins around it. Without
    // trimming that away first, object-fit:contain has to fit the whole
    // canvas — padding included — into the display box, so the real
    // logo ends up looking tiny inside it even though the box itself is
    // sized correctly. trim() crops to just the actual visible content.
    if (options?.trim) {
      pipeline = pipeline.trim();
    }
    const webpBuffer = await pipeline
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const record = await prisma.uploadedImage.create({
      data: { data: new Uint8Array(webpBuffer), mimeType: "image/webp" },
    });

    return { ok: true, url: `/api/images/${record.id}` };
  } catch (e) {
    // Logged server-side (visible in Vercel's function logs) so the
    // real cause is diagnosable even though the client only ever sees
    // a safe, generic message — Next.js redacts thrown-error details
    // in production, but a *returned* error object like this one isn't
    // redacted, so wrapping literally everything (including auth() and
    // validation, previously outside the try/catch) in this single
    // catch is what actually gets a real message to the user instead
    // of the opaque "Server Components render" fallback.
    console.error("uploadImage failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to process image." };
  }
}

/** Admin-only cleanup — not currently wired to any UI button, but
 * available for future use (e.g. removing an old logo after replacing it). */
export async function deleteUploadedImage(imageId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role)) return { ok: false, error: "Not authorized." };
  await prisma.uploadedImage.delete({ where: { id: imageId } });
  return { ok: true };
}
