/**
 * Round 54 (Amendment 1) - re-runs Lulu's file check on a print interior that was already uploaded, the same way the
 * form does, and prints Lulu's verdict for Paperback and Hardcover. It creates NO print job and NO order, and it
 * never prints any key. It uses the new signed, expiring file link.
 *
 *   $env:DATABASE_URL = "<paste the database connection string here>"
 *   npx tsx scripts/recheck-print-file.ts --file=<uploaded file id> --site=https://your-site-address
 *
 * --file  the interior's file id: the last part of the address Lulu was given (.../api/files/<this>).
 * --site  the public address Lulu should download from (default: the site's public address).
 *
 * First it downloads the signed link itself and prints the HTTP status (200 means the file route works), then it
 * asks Lulu to validate the interior for a Paperback and a Hardcover package and waits for each verdict.
 */
import { PrismaClient } from "@prisma/client";
import { buildPodPackageId } from "../lib/lulu-config";
import { toLuluPodPackageId } from "../lib/lulu-order";
import { getLuluValidation, startLuluValidation } from "../lib/payments/lulu";
import { CHECK_LINK_SECONDS, luluFileUrl } from "../lib/signed-file-url";
import { getPublicSiteUrl } from "../lib/seo/site-url";

const prisma = new PrismaClient();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const fileId = arg("file");
  if (!fileId) { console.log("Tell me the file: --file=<uploaded file id>"); return; }
  const site = (arg("site") || getPublicSiteUrl()).replace(/\/+$/, "");
  const file = await prisma.uploadedFile.findUnique({ where: { id: fileId }, select: { originalName: true, mimeType: true } });
  if (!file) { console.log("No uploaded file has that id in this database."); return; }
  console.log(`File: "${file.originalName}" (${file.mimeType})`);

  const url = luluFileUrl(`/api/files/${fileId}`, site, CHECK_LINK_SECONDS);
  if (!url || !url.includes("/api/lulu-files/")) { console.log("No signing secret is available here (AUTH_SECRET), so a signed link cannot be made."); return; }
  const res = await fetch(url).catch((e) => ({ status: 0, ok: false, statusText: e instanceof Error ? e.message : "no answer" }) as Response);
  console.log(`Signed link answers: ${res.status} ${res.statusText || ""}`.trim());
  if (!res.ok) { console.log("The site itself cannot serve the file, so Lulu would fail too. Nothing was sent to Lulu."); return; }

  const check = await prisma.printPreflightCheck.findFirst({ where: { interiorFileId: fileId }, orderBy: { createdAt: "desc" }, select: { packageIds: true } });
  const trim = (arg("trim") || "0600X0900");
  const fallback = [
    toLuluPodPackageId(buildPodPackageId({ trimCode: trim, colorCode: "BW", qualityCode: "STD", bindingCode: "PB", paperCode: "060UW444", finishCode: "M", linenCode: "X", foilCode: "X" })),
    toLuluPodPackageId(buildPodPackageId({ trimCode: trim, colorCode: "BW", qualityCode: "STD", bindingCode: "LW", paperCode: "060UW444", finishCode: "M", linenCode: "X", foilCode: "X" })),
  ];
  const packages = check?.packageIds ? check.packageIds.split(",") : fallback;
  console.log(check?.packageIds ? "Using the package codes from the last check of this file." : `No earlier check found; using ${trim} black-and-white defaults (add --trim=<code> to change).`);

  for (const pkg of packages) {
    const started = await startLuluValidation({ kind: "interior", sourceUrl: url, podPackageId: pkg });
    if (!started.ok) { console.log(`${pkg}: could not start (${started.error})`); continue; }
    let parsed = started.parsed;
    for (let i = 0; i < 40 && parsed.state === "running"; i++) {
      await sleep(5000);
      const r = await getLuluValidation("interior", started.id);
      if (r.ok) parsed = r.parsed;
    }
    console.log(`${pkg}: ${parsed.state.toUpperCase()} (${parsed.status})${parsed.errors.length ? `\n    ${parsed.errors.join("\n    ")}` : ""}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
