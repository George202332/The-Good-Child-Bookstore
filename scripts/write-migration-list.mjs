// Writes lib/expected-migrations.json: the names of every migration folder in prisma/migrations, in order.
// Runs automatically before every build ("prebuild" in package.json), so the deployed site always knows which
// migrations its code expects. Site Health compares this list with the migrations the connected database has applied.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "prisma", "migrations");
const names = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory()).sort();
writeFileSync(join(root, "lib", "expected-migrations.json"), JSON.stringify(names, null, 2) + "\n");
console.log(`[migrations] ${names.length} migrations expected by this code`);
