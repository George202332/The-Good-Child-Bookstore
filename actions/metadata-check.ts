"use server";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export interface MetadataCheckResult {
  titleFound: boolean;
  authorFound: boolean;
  checked: boolean;
  error?: string;
}

/**
 * Checks whether the entered book title and author name actually
 * appear anywhere in the first couple of pages of the uploaded
 * manuscript file — catches the real, honest case the checklist is
 * meant to catch: uploading the wrong manuscript, or one for a
 * different title/author than what was typed into the form.
 *
 * Reads genuine embedded PDF text via pdfjs-dist (the same library
 * already used for the manuscript viewer) — not OCR. A cover image
 * mismatch specifically (comparing text *drawn on* a cover image
 * against the manuscript) would need real OCR infrastructure, which
 * isn't something reliable to add in a serverless environment; this
 * check covers the manuscript/form-field consistency instead, which is
 * the same class of real error and doesn't need that.
 */
export async function checkManuscriptMetadata(fileId: string, expectedTitle: string, expectedAuthor: string): Promise<MetadataCheckResult> {
  if (!fileId || !expectedTitle.trim()) return { titleFound: true, authorFound: true, checked: false };

  try {
    const { prisma } = await import("@/lib/prisma");
    const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
    if (!file || file.mimeType !== "application/pdf") {
      // Not a PDF (an EPUB/MOBI upload, or the file wasn't found) —
      // nothing this check can read text from, so it stays silent
      // rather than reporting a false mismatch.
      return { titleFound: true, authorFound: true, checked: false };
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(file.data) }).promise;
    const pagesToCheck = Math.min(2, doc.numPages);
    let text = "";
    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += " " + content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    }
    const normalizedText = normalize(text);

    const titleFound = normalizedText.includes(normalize(expectedTitle));
    const authorWords = normalize(expectedAuthor).split(" ").filter((w) => w.length > 1);
    const authorFound = expectedAuthor.trim() === "" || authorWords.length === 0 || authorWords.every((w) => normalizedText.includes(w));

    return { titleFound, authorFound, checked: true };
  } catch (e) {
    // A read/parse failure isn't the same as a real mismatch — stay
    // silent rather than falsely flagging a good file.
    return { titleFound: true, authorFound: true, checked: false, error: e instanceof Error ? e.message : "Couldn't read the manuscript." };
  }
}
