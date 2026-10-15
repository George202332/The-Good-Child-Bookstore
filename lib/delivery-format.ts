/**
 * Which purchased formats come with a file download. Paperback and
 * hardcover copies are printed and shipped by Lulu, so a print purchase
 * never unlocks a file download anywhere (library, confirmation page,
 * receipt email, download route, "Downloads" counter). eBook and audiobook
 * purchases do; a line with no format recorded is an older eBook purchase
 * (made before formats were tracked) and keeps its download.
 */
export function isPrintFormat(format: string | null | undefined): boolean {
  return format === "paperback" || format === "hardcover";
}

export function hasFileDownload(format: string | null | undefined): boolean {
  return !isPrintFormat(format);
}
