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

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB before conversion

export interface UploadImageResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function uploadImage(formData: FormData): Promise<UploadImageResult> {
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
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please upload an image file." };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const webpBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const record = await prisma.uploadedImage.create({
      data: { data: new Uint8Array(webpBuffer), mimeType: "image/webp" },
    });

    return { ok: true, url: `/api/images/${record.id}` };
  } catch (e) {
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
