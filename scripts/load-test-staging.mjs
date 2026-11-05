// SAFE LOAD TEST FOR STAGING ONLY.
// Run:  node scripts/load-test-staging.mjs https://your-staging-address.vercel.app
// What it does: sends ordinary page requests (GET only) to a short list of public pages, at a gentle, rising pace, for about 2 minutes,
// then prints how fast the pages answered and how many failed. It never logs in, never buys, never posts a form, and never reads a key.
// Safety: it REFUSES to run unless the address answers with the staging "noindex" header (the live site never sends it), and it
// asks you to type STAGING before it starts. Send the printed result to Claude.
import readline from "node:readline/promises";

const target = (process.argv[2] || "").replace(/\/+$/, "");
const PAGES = ["/", "/bookshelf", "/bookshelf?q=story", "/blog", "/about", "/faq"];
const STEPS = [{ users: 5, seconds: 20 }, { users: 15, seconds: 30 }, { users: 30, seconds: 40 }, { users: 50, seconds: 30 }];

function fail(msg) { console.error("\nSTOPPED: " + msg + "\n"); process.exit(1); }
if (!/^https:\/\/[^/]+$/.test(target)) fail("Give the staging address, like https://your-staging.vercel.app (https, no path).");

const probe = await fetch(target + "/robots.txt", { redirect: "manual" }).catch(() => null);
if (!probe) fail("Could not reach that address.");
const robots = probe.headers.get("x-robots-tag") || "";
if (!/noindex/i.test(robots)) fail("This address does NOT send the staging 'noindex' header, so it may be the LIVE site. Nothing was sent.");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`Target: ${target}\nThis is a staging site (noindex header present).`);
const ok = (await rl.question("Type STAGING to start the load test: ")).trim();
rl.close();
if (ok !== "STAGING") fail("Not confirmed. Nothing was sent.");

const results = [];
async function one(path) {
  const t = performance.now();
  try {
    const res = await fetch(target + path, { headers: { "User-Agent": "gcb-staging-load-test" } });
    await res.arrayBuffer();
    results.push({ path, ms: performance.now() - t, status: res.status });
  } catch { results.push({ path, ms: performance.now() - t, status: 0 }); }
}
const pct = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.ceil((p / 100) * arr.length) - 1)] : 0);

for (const step of STEPS) {
  console.log(`\n${step.users} visitors at once for ${step.seconds}s ...`);
  const end = Date.now() + step.seconds * 1000;
  const before = results.length;
  await Promise.all(Array.from({ length: step.users }, async (_, i) => {
    let n = i;
    while (Date.now() < end) { await one(PAGES[n++ % PAGES.length]); await new Promise((r) => setTimeout(r, 400 + Math.random() * 800)); }
  }));
  const slice = results.slice(before);
  const ms = slice.map((r) => r.ms).sort((a, b) => a - b);
  const bad = slice.filter((r) => r.status === 0 || r.status >= 500).length;
  console.log(`  requests ${slice.length}, failed ${bad}, median ${Math.round(pct(ms, 50))} ms, 95% within ${Math.round(pct(ms, 95))} ms, slowest ${Math.round(ms[ms.length - 1] || 0)} ms`);
  if (bad / Math.max(1, slice.length) > 0.2) { console.log("  Too many failures: stopping early so staging is not hammered."); break; }
}
const byPage = {};
for (const r of results) (byPage[r.path] ||= []).push(r);
console.log("\nPer page (all steps):");
for (const [p, v] of Object.entries(byPage)) {
  const ms = v.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`  ${p.padEnd(22)} n=${String(v.length).padEnd(4)} median ${String(Math.round(pct(ms, 50))).padEnd(5)} ms  95% ${Math.round(pct(ms, 95))} ms  failed ${v.filter((r) => r.status === 0 || r.status >= 500).length}`);
}
console.log("\nDone. Copy everything above and send it to Claude.");
