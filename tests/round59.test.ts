import test from "node:test";
import assert from "node:assert/strict";
import { resolvePaystack } from "../lib/payment-env";
import { decidePreflightGate } from "../lib/print-preflight-gate";

test("Paystack: a test key still works when the saved mode label says live", () => {
  const r = resolvePaystack({}, "live", { secretKey: "sk_test_abc", publicKey: "pk_test_abc" });
  assert.equal(r.mode, "test");
  assert.equal(r.keys.secretKey, "sk_test_abc");
  assert.equal(r.source, "key");
});

test("Paystack: PAYSTACK_MODE set in Vercel stays strict", () => {
  const r = resolvePaystack({ PAYSTACK_MODE: "live" }, "test", { secretKey: "sk_test_abc" });
  assert.equal(r.mode, "live");
  assert.equal(r.keys.secretKey, undefined);
});

test("Paystack: matching key and mode is unchanged", () => {
  const r = resolvePaystack({ PAYSTACK_TEST_SECRET_KEY: "sk_test_x" }, null, {});
  assert.equal(r.mode, "test");
  assert.equal(r.keys.secretKey, "sk_test_x");
  assert.equal(r.source, "default");
});

test("print check: a passed result is kept for the same files even if a print setting changed", () => {
  const saved = { status: "PASSED" as const, checkedAt: "2026-11-01T00:00:00.000Z", checkId: "c1", interiorFileId: "f1", coverKey: "k1", packageIds: "old", reasons: [] };
  const d = decidePreflightGate({ keys: { interiorFileId: "f1", coverKey: "k1", packageIds: "new" }, latest: null, saved, requirePass: true });
  assert.equal(d.ok, true);
});

test("print check: a new interior file or a new cover needs a new check", () => {
  const saved = { status: "PASSED" as const, checkedAt: "2026-11-01T00:00:00.000Z", checkId: "c1", interiorFileId: "f1", coverKey: "k1", packageIds: "p", reasons: [] };
  assert.equal(decidePreflightGate({ keys: { interiorFileId: "f2", coverKey: "k1", packageIds: "p" }, latest: null, saved, requirePass: true }).ok, false);
  assert.equal(decidePreflightGate({ keys: { interiorFileId: "f1", coverKey: "k2", packageIds: "p" }, latest: null, saved, requirePass: true }).ok, false);
});

import { planSpineText, SPINE_TEXT_MIN_IN } from "../lib/spine-text";
import { standardScene, visibleFaceKeys } from "../lib/mockup/scene";
import { generatedWrapCrops } from "../lib/mockup/wrap";
import sharp from "sharp";

const width = (t: string, s: number) => t.length * s * 0.55;

test("spine writing: nothing on a thin spine", () => {
  assert.equal(planSpineText({ spine: 0.2 * 72, length: 612, unitsPerInch: 72, title: "A Title", author: "A Writer", width }), null);
  assert.ok(SPINE_TEXT_MIN_IN > 0.2);
});

test("spine writing: author at the top, title below it", () => {
  const plan = planSpineText({ spine: 0.7 * 72, length: 612, unitsPerInch: 72, title: "The Friend", author: "Liam Walker", width });
  assert.ok(plan);
  assert.equal(plan!.lines.length, 2);
  assert.equal(plan!.lines[0].text, "Liam Walker");
  assert.equal(plan!.lines[1].text, "The Friend");
  assert.ok(plan!.lines[1].start > plan!.lines[0].start);
});

test("spine writing: a long title is shortened to fit, never overflows", () => {
  const plan = planSpineText({ spine: 0.7 * 72, length: 300, unitsPerInch: 72, title: "A".repeat(200), author: "B".repeat(100), width });
  assert.ok(plan);
  for (const l of plan!.lines) assert.ok(l.start + width(l.text, l.size) <= 300);
});

test("mockup scene: one standing copy resting on a pile of three flat copies", () => {
  const dims = { w: 5.5, h: 8.5, t: 0.4 };
  const tex = { w: 10, h: 10, svg: "" };
  const t = { front: tex, back: tex, spine: tex, foreEdge: tex, top: tex, bottom: tex };
  const placements = standardScene({ dims, tex: t }, { dims, tex: t });
  assert.equal(placements.length, 4);
  assert.equal(placements.filter((p) => p.lying).length, 3);
  const standing = placements.filter((p) => !p.lying);
  assert.equal(standing.length, 1);
  assert.ok(Math.abs(standing[0].yaw) < 45, "the standing copy faces the viewer");
  assert.ok(Math.abs((standing[0].lift ?? 0) - 3 * dims.t) < 1e-9, "it rests on top of the pile");
  assert.ok((standing[0].tilt ?? 0) > 5, "it leans back");
  assert.ok(visibleFaceKeys(standing[0]).includes("spine") && visibleFaceKeys(standing[0]).includes("front") && visibleFaceKeys(standing[0]).includes("top"));
});

test("generated wrap: front is the trim shape and the spine carries the shared writing", async () => {
  const img = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 60, g: 130, b: 90 } } }).png().toBuffer();
  const crops = await generatedWrapCrops({ frontImage: img, title: "The Friend I Made", author: "Liam Walker", trimCode: "0550X0850", paperCode: "060UW444", pages: 300 });
  const f = await sharp(crops.front).metadata();
  assert.ok(Math.abs((f.width! / f.height!) - 5.5 / 8.5) < 0.01);
  const s = await sharp(crops.spine).metadata();
  assert.ok(s.height! > s.width! * 5);
  assert.equal(crops.source, "generated");
});
