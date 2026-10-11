import test from "node:test";
import assert from "node:assert/strict";
import { bannerClassName, bannerImageStyle } from "../lib/banner-style";
import { DEFAULT_PAGES_CONTENT } from "../lib/page-content";

test("banner with an image has the picture only — no dark overlay layer", () => {
  const style = bannerImageStyle("/api/images/abc");
  assert.equal(style.backgroundImage, 'url("/api/images/abc")');
  assert.ok(!String(style.backgroundImage).includes("gradient"));
  assert.equal(style.backgroundSize, "cover");
});

test("no image means no background styling", () => {
  assert.deepEqual(bannerImageStyle(undefined), {});
  assert.deepEqual(bannerImageStyle(""), {});
  assert.equal(bannerClassName("promo-banner", undefined), "promo-banner");
  assert.equal(bannerClassName("promo-banner", "/x.png"), "promo-banner promo-banner-on-image");
});

test("quotes in an image address cannot break out of the url()", () => {
  const style = bannerImageStyle('/a"b.png');
  assert.equal(style.backgroundImage, 'url("/a%22b.png")');
});

test("Authorship and Affiliate both have two editable banners with defaults", () => {
  for (const page of [DEFAULT_PAGES_CONTENT.authorship, DEFAULT_PAGES_CONTENT.affiliateMarketing]) {
    assert.ok(page.heading.length > 0);
    assert.ok(page.ctaBannerTitle.length > 0);
    assert.equal(typeof page.ctaBannerBody, "string");
  }
});
