/**
 * Word documents (DOC / DOCX and the related template/macro types) are not accepted
 * as manuscripts anywhere on the site. This is the single rule the server upload
 * (actions/files.ts) uses to refuse them, judged by file name AND reported type so
 * renaming alone does not slip one through.
 */
export function isWordDocument(fileName: string, mimeType: string): boolean {
  const name = (fileName || "").toLowerCase();
  const type = (mimeType || "").toLowerCase();
  return (
    name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".docm") || name.endsWith(".dotx") || name.endsWith(".dot") ||
    type === "application/msword" || type.includes("wordprocessingml") || type.includes("ms-word")
  );
}
