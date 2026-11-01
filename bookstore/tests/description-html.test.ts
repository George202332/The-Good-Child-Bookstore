import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDescriptionHtml as s, descriptionToPlainText, safeHref } from "../lib/description-html";

test("normal formatting is kept exactly", () => {
  const html = '<h2>Title</h2><p style="text-align:center"><strong>Bold</strong> <em>it</em> <u>un</u></p><ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>';
  assert.equal(s(html), html);
});

test("b, i and div become strong, em and p", () => {
  assert.equal(s("<div><b>x</b> <i>y</i></div>"), "<p><strong>x</strong> <em>y</em></p>");
});

test("scripts, handlers, styles and frames are removed", () => {
  assert.equal(s('<p onclick="alert(1)">hi</p><script>alert(1)</script>'), "<p>hi</p>");
  assert.equal(s('<p style="background:url(javascript:alert(1))">x</p>'), "<p>x</p>");
  assert.equal(s('<iframe src="https://evil"></iframe><p>ok</p>'), "<p>ok</p>");
  assert.equal(s('<img src=x onerror=alert(1)>text'), "text");
  assert.ok(!/script|onerror|javascript/i.test(s('<svg><script>alert(1)</script></svg><p>a</p>')));
});

test("links keep only safe addresses and get safe attributes", () => {
  assert.equal(s('<a href="https://example.com/a?b=1&c=2">go</a>'), '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">go</a>');
  assert.equal(s('<a href="javascript:alert(1)">bad</a>'), "bad");
  assert.equal(s('<a href=" jav&#x61;script:alert(1)">bad</a>'), "bad");
  assert.equal(safeHref("JaVaScRiPt:alert(1)"), null);
  assert.equal(safeHref("mailto:a@b.com"), "mailto:a@b.com");
});

test("broken markup is closed, empty blocks dropped, stray < escaped", () => {
  assert.equal(s("<p><strong>open"), "<p><strong>open</strong></p>");
  assert.equal(s("<p></p><p><br></p><p>a</p>"), "<p>a</p>");
  assert.equal(s("a < b"), "a &lt; b");
  assert.equal(s(null), "");
});

test("plain text drops the formatting and counts characters", () => {
  assert.equal(descriptionToPlainText("<h2>Hi</h2><p>there <strong>you</strong> &amp; me</p>"), "Hi there you & me");
});
