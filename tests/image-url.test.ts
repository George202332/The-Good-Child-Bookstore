import test from "node:test";
import assert from "node:assert/strict";
import { responsiveImage, imageAtWidth, parseRequestedWidth, isUploadedImage } from "../lib/image-url";

test("only our own uploaded pictures get resized copies", () => {
  assert.equal(isUploadedImage("/api/images/abc123"), true);
  assert.equal(isUploadedImage("https://example.com/x.png"), false);
  assert.equal(imageAtWidth("https://example.com/x.png", 480), "https://example.com/x.png");
  assert.equal(imageAtWidth("/api/images/abc", 480), "/api/images/abc?w=480");
});

test("srcset lists the widths smallest first", () => {
  const r = responsiveImage("/api/images/abc", [960, 480, 240]);
  assert.equal(r.srcSet, "/api/images/abc?w=240 240w, /api/images/abc?w=480 480w, /api/images/abc?w=960 960w");
  assert.equal(r.src, "/api/images/abc?w=480");
  assert.deepEqual(responsiveImage("https://x/y.png", [480]), { src: "https://x/y.png" });
});

test("the route accepts only the allowed widths", () => {
  assert.equal(parseRequestedWidth("480"), 480);
  assert.equal(parseRequestedWidth("481"), null);
  assert.equal(parseRequestedWidth("99999"), null);
  assert.equal(parseRequestedWidth(null), null);
  assert.equal(parseRequestedWidth("abc"), null);
});
