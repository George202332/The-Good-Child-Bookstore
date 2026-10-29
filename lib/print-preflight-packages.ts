import { buildPodPackageId } from "@/lib/lulu-config";
import { toLuluPodPackageId } from "@/lib/lulu-order";

export interface PackageSettings {
  trimCode: string;
  paperbackEnabled: boolean;
  hardcoverEnabled: boolean;
  paperbackBinding: string;
  interiorColor: string;
  printQuality: string;
  paperType: string;
  coverFinish: string;
  linenColor: string;
  foilColor: string;
}

/** The Lulu package ids a form's settings describe, for each enabled print format. */
export function packagesFor(input: PackageSettings) {
  const out: { format: "paperback" | "hardcover"; bindingCode: string; packageId: string }[] = [];
  const base = { trimCode: input.trimCode, colorCode: input.interiorColor, qualityCode: input.printQuality, paperCode: input.paperType, finishCode: input.coverFinish };
  if (input.paperbackEnabled) {
    out.push({ format: "paperback", bindingCode: input.paperbackBinding, packageId: toLuluPodPackageId(buildPodPackageId({ ...base, bindingCode: input.paperbackBinding, linenCode: "X", foilCode: "X" })) });
  }
  if (input.hardcoverEnabled) {
    out.push({ format: "hardcover", bindingCode: "LW", packageId: toLuluPodPackageId(buildPodPackageId({ ...base, bindingCode: "LW", linenCode: input.linenColor, foilCode: input.foilColor })) });
  }
  return out;
}

