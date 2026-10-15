import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLuluEnvironment,
  luluBaseUrl,
  toLuluPodPackageId,
  LULU_POD_PACKAGE_ID_MAX,
  absoluteFileUrl,
  composeShipAddress,
  parseShipAddress,
  normaliseStateCode,
  cleanPhone,
  buildLuluAddress,
  shippingProblems,
  lineProblems,
  buildLuluPrintJobBody,
} from "../lib/lulu-order";

test("environment: stored setting wins, then env var, then payment mode", () => {
  assert.equal(resolveLuluEnvironment({ stored: "production", envVar: "sandbox", paymentMode: "test" }), "production");
  assert.equal(resolveLuluEnvironment({ stored: null, envVar: "live", paymentMode: "test" }), "production");
  assert.equal(resolveLuluEnvironment({ paymentMode: "live" }), "production");
  assert.equal(resolveLuluEnvironment({ paymentMode: "test" }), "sandbox");
  assert.equal(resolveLuluEnvironment({}), "sandbox");
  assert.equal(luluBaseUrl("production"), "https://api.lulu.com");
  assert.equal(luluBaseUrl("sandbox"), "https://api.sandbox.lulu.com");
});

test("pod package id loses separators and fits 27 characters", () => {
  const id = toLuluPodPackageId("0600X0900.BW.STD.PB.060UW444.M.X.X");
  assert.equal(id, "0600X0900BWSTDPB060UW444MXX");
  assert.ok(id.length <= LULU_POD_PACKAGE_ID_MAX);
});

test("absoluteFileUrl", () => {
  assert.equal(absoluteFileUrl("/api/files/a", "https://x.com/"), "https://x.com/api/files/a");
  assert.equal(absoluteFileUrl("https://c.io/a.pdf", "https://x.com"), "https://c.io/a.pdf");
  assert.equal(absoluteFileUrl("data:image/png;base64,AA", "https://x.com"), null);
  assert.equal(absoluteFileUrl("", "https://x.com"), null);
  assert.equal(absoluteFileUrl(null, "https://x.com"), null);
});

test("address compose/parse round trip, with and without state", () => {
  const withState = composeShipAddress({ street: "12 Main St", city: "Springfield", state: "Illinois", postcode: "62704" });
  assert.deepEqual(parseShipAddress(withState), { street1: "12 Main St", city: "Springfield", state: "Illinois", postcode: "62704" });
  const noState = composeShipAddress({ street: "5 High Rd", city: "Nairobi", postcode: "00100" });
  assert.deepEqual(parseShipAddress(noState), { street1: "5 High Rd", city: "Nairobi", state: "", postcode: "00100" });
});

test("legacy free-text address is read best-effort, unreadable gives empty fields", () => {
  const p = parseShipAddress("12 Main St, Springfield, IL 62704");
  assert.equal(p.city, "Springfield");
  assert.equal(p.state, "IL");
  assert.equal(p.postcode, "62704");
  const bad = parseShipAddress("somewhere far away");
  assert.equal(bad.city, "");
  assert.equal(bad.postcode, "");
});

test("state codes and phone cleaning", () => {
  assert.equal(normaliseStateCode("US", "Illinois"), "IL");
  assert.equal(normaliseStateCode("US", "il"), "IL");
  assert.equal(normaliseStateCode("US", "Nowhere"), "");
  assert.equal(normaliseStateCode("CA", "Ontario"), "ON");
  assert.equal(normaliseStateCode("KE", ""), "");
  assert.equal(cleanPhone("+254 (700) 123-456"), "+254700123456");
  assert.equal(cleanPhone(null), "");
});

test("shippingProblems reports exactly what is missing", () => {
  const ok = buildLuluAddress({
    name: "Jane", email: "j@x.com", countryIso: "US", phone: "+15551234567",
    rawAddress: composeShipAddress({ street: "1 A St", city: "Austin", state: "Texas", postcode: "73301" }),
  });
  assert.equal(ok.state_code, "TX");
  assert.deepEqual(shippingProblems(ok), []);

  const noState = buildLuluAddress({
    name: "Jane", email: "j@x.com", countryIso: "US",
    rawAddress: composeShipAddress({ street: "1 A St", city: "Austin", postcode: "73301" }),
  });
  assert.ok(shippingProblems(noState).some((p) => p.includes("state")));

  const empty = buildLuluAddress({ name: "", email: "", countryIso: "", rawAddress: "" });
  assert.ok(shippingProblems(empty).length >= 5);

  const ke = buildLuluAddress({
    name: "Jo", email: "j@x.com", countryIso: "KE",
    rawAddress: composeShipAddress({ street: "1 Moi Ave", city: "Nairobi", postcode: "00100" }),
  });
  assert.deepEqual(shippingProblems(ke), []);
});

test("lineProblems and print job body", () => {
  const line = { title: "Book", podPackageId: "0600X0900.BW.STD.PB.060UW444.M.X.X", coverUrl: "https://x/c.png", interiorUrl: "https://x/i.pdf", quantity: 2 };
  assert.deepEqual(lineProblems(line), []);
  assert.ok(lineProblems({ ...line, interiorUrl: "" }).length === 1);
  assert.ok(lineProblems({ ...line, quantity: 0 }).length === 1);
  assert.ok(lineProblems({ ...line, podPackageId: "A".repeat(30) }).length === 1);

  const address = buildLuluAddress({ name: "Jo", email: "j@x.com", countryIso: "KE", rawAddress: "1 Moi Ave\nNairobi\n00100", phone: "+254700000000" });
  const body = buildLuluPrintJobBody({ externalId: "ord1", contactEmail: "s@x.com", address, lines: [line] });
  assert.equal(body.external_id, "ord1");
  assert.equal(body.shipping_level, "MAIL");
  assert.equal(body.line_items[0].printable_normalization.pod_package_id, "0600X0900BWSTDPB060UW444MXX");
  assert.equal(body.line_items[0].quantity, 2);
  assert.equal(body.line_items[0].printable_normalization.cover.source_url, "https://x/c.png");
  assert.equal(body.shipping_address.country_code, "KE");
});

import { composeShipAddress as compose2, parseShipAddress as parse2, shippingLevelsFor, resolveShippingLevel, normaliseEnabledLevels } from "../lib/lulu-order";

test("five-line address keeps street line 2 and never confuses city with state", () => {
  const raw = compose2({ street: "12 Main St", street2: "Apt 4", city: "Nairobi", postcode: "00100" });
  assert.equal(raw.split("\n").length, 5);
  assert.deepEqual(parse2(raw), { street1: "12 Main St", street2: "Apt 4", city: "Nairobi", state: "", postcode: "00100" });
  const full = compose2({ street: "1 A St", city: "Austin", state: "Texas", postcode: "73301" });
  assert.deepEqual(parse2(full), { street1: "1 A St", city: "Austin", state: "Texas", postcode: "73301" });
});

test("shipping methods: country rules, defaults and fallbacks", () => {
  assert.equal(normaliseEnabledLevels(undefined).length, 5);
  assert.equal(normaliseEnabledLevels(["nonsense"]).length, 5);
  assert.deepEqual(normaliseEnabledLevels(["EXPRESS", "MAIL"]), ["MAIL", "EXPRESS"]);
  assert.ok(shippingLevelsFor("US", undefined).some((l) => l.id === "GROUND"));
  assert.ok(!shippingLevelsFor("KE", undefined).some((l) => l.id === "GROUND"));
  assert.equal(resolveShippingLevel("EXPRESS", "KE", undefined), "EXPRESS");
  assert.equal(resolveShippingLevel("GROUND", "KE", undefined), "MAIL");
  assert.equal(resolveShippingLevel("EXPRESS", "KE", ["MAIL"]), "MAIL");
  assert.equal(resolveShippingLevel(null, "KE", ["PRIORITY_MAIL"]), "PRIORITY_MAIL");
  // Everything the country allows switched off -> standard mail still offered.
  assert.deepEqual(shippingLevelsFor("KE", ["GROUND"]).map((l) => l.id), ["MAIL"]);
});

test("print job body carries the chosen shipping level and no stray line-level package id", () => {
  const address = buildLuluAddress({ name: "Jo", email: "j@x.com", countryIso: "KE", rawAddress: "1 Moi Ave\n\nNairobi\n\n00100", phone: "+254700000000" });
  const body = buildLuluPrintJobBody({
    externalId: "o1", contactEmail: "s@x.com", address, shippingLevel: "EXPRESS",
    lines: [{ title: "B", podPackageId: "0600X0900BWSTDPB060UW444MXX", coverUrl: "https://x/c.pdf", interiorUrl: "https://x/i.pdf", quantity: 1 }],
  });
  assert.equal(body.shipping_level, "EXPRESS");
  assert.ok(!("pod_package_id" in body.line_items[0]));
  assert.equal(body.shipping_address.street1, "1 Moi Ave");
  assert.equal(body.shipping_address.city, "Nairobi");
});
