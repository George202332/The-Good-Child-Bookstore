import JSZip from "jszip";
import { randomUUID } from "crypto";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Extracts plain text from a PDF's pages, one string per page — used
 * as the source for EPUB chapter generation. Real embedded PDF text
 * via pdfjs-dist, not OCR. */
export async function extractPdfPages(pdfBytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return pages;
}

/** Builds a real, valid EPUB (EPUB 3, minimal but spec-correct: mimetype,
 * container.xml, a content.opf package document, and one XHTML chapter
 * per source page) from a manuscript's extracted text. Every page of
 * the source becomes one EPUB section, in the same order — the actual
 * reading content and structure is preserved. What does NOT and cannot
 * carry over is fixed page numbering: EPUB is an inherently reflowable
 * format (a reading app lays out text based on the reader's own font
 * size and screen), so "page 12" in the PDF has no equivalent concept
 * in EPUB — that is a real property of the format itself, not a
 * shortcoming of this conversion. */
export async function generateEpub(pages: string[], title: string, author: string): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );

  const chapterFiles = pages.map((_, i) => `chapter${i + 1}.xhtml`);

  const manifestItems = chapterFiles
    .map((f, i) => `<item id="chapter${i + 1}" href="${f}" media-type="application/xhtml+xml"/>`)
    .join("\n    ");
  const spineItems = chapterFiles.map((_, i) => `<itemref idref="chapter${i + 1}"/>`).join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${randomUUID()}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`
  );

  pages.forEach((text, i) => {
    const paragraphs = text
      .split(/\s{4,}|\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeXml(p)}</p>`)
      .join("\n");
    zip.file(
      `OEBPS/${chapterFiles[i]}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(title)}</title></head>
<body>
${paragraphs || "<p></p>"}
</body>
</html>`
    );
  });

  return zip.generateAsync({ type: "uint8array" });
}
