import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveRestrictedCountries,
  isBookVisibleToVisitor,
  isFormatPurchasable,
  isLineRestricted,
  isSellOnStoreDisabled,
  resolveFormatPrice,
  visitorCountryList,
  type FormatPricingInput,
} from "../lib/book-visibility";

describe("isLineRestricted", () => {
  test("unknown buyer country never restricts", () => {
    assert.equal(isLineRestricted(["US"], {}, "ebook"), false);
    assert.equal(isLineRestricted(["US"], { accountCountry: null, geoCountry: undefined }, "ebook"), false);
  });
  test("account country or request geo can restrict", () => {
    assert.equal(isLineRestricted(["US", "CA"], { accountCountry: "ca" }, "ebook"), true);
    assert.equal(isLineRestricted(["US", "CA"], { geoCountry: "US" }, "audiobook"), true);
    assert.equal(isLineRestricted(["US"], { accountCountry: "KE", geoCountry: "KE" }, "ebook"), false);
  });
  test("ship-to country only counts for print lines", () => {
    assert.equal(isLineRestricted(["DE"], { shipCountry: "DE" }, "paperback"), true);
    assert.equal(isLineRestricted(["DE"], { shipCountry: "DE" }, "hardcover"), true);
    assert.equal(isLineRestricted(["DE"], { shipCountry: "DE" }, "ebook"), false);
    assert.equal(isLineRestricted(["DE"], { shipCountry: "DE" }, "audiobook"), false);
  });
  test("an empty restriction list never restricts", () => {
    assert.equal(isLineRestricted([], { accountCountry: "US", geoCountry: "US", shipCountry: "US" }, "paperback"), false);
  });
});

describe("isBookVisibleToVisitor", () => {
  test("hidden for a restricted visitor, visible otherwise", () => {
    assert.equal(isBookVisibleToVisitor({ restrictedCountries: ["US"] }, ["US"]), false);
    assert.equal(isBookVisibleToVisitor({ restrictedCountries: ["US"] }, ["KE"]), true);
    assert.equal(isBookVisibleToVisitor({ restrictedCountries: ["US"] }, []), true);
    assert.equal(isBookVisibleToVisitor({}, ["US"]), true);
  });
  test("sellOnStore false hides it for everyone", () => {
    assert.equal(isBookVisibleToVisitor({ sellOnStore: false }, []), false);
    assert.equal(isBookVisibleToVisitor({ sellOnStore: true }, []), true);
  });
});

describe("isSellOnStoreDisabled", () => {
  test("only an explicit false disables selling", () => {
    assert.equal(isSellOnStoreDisabled({ sellOnStore: false }), true);
    assert.equal(isSellOnStoreDisabled({ sellOnStore: true }), false);
    assert.equal(isSellOnStoreDisabled({}), false);
    assert.equal(isSellOnStoreDisabled(null), false);
    assert.equal(isSellOnStoreDisabled(undefined), false);
    assert.equal(isSellOnStoreDisabled({ sellOnStore: "false" }), false);
  });
});

describe("effectiveRestrictedCountries", () => {
  test("uses the array when present", () => {
    assert.deepEqual(effectiveRestrictedCountries({ restrictedCountries: ["us", "CA"] }), ["US", "CA"]);
  });
  test("falls back to the legacy string only when worldwideRights is false", () => {
    const legacy = { worldwideRights: false, countryRestrictions: "US, Canada" };
    assert.deepEqual(effectiveRestrictedCountries({ restrictedCountries: [], submissionMetadata: legacy }), ["US", "CA"]);
    assert.deepEqual(
      effectiveRestrictedCountries({ restrictedCountries: [], submissionMetadata: { worldwideRights: true, countryRestrictions: "US" } }),
      [],
    );
    assert.deepEqual(effectiveRestrictedCountries({ restrictedCountries: [] }), []);
  });
});

describe("visitorCountryList", () => {
  test("de-duplicates, upper-cases and drops unknowns", () => {
    assert.deepEqual(visitorCountryList({ accountCountry: "ke", geoCountry: "KE" }), ["KE"]);
    assert.deepEqual(visitorCountryList({ accountCountry: null, geoCountry: "us" }), ["US"]);
    assert.deepEqual(visitorCountryList({}), []);
  });
});

function book(over: Partial<FormatPricingInput> = {}): FormatPricingInput {
  return {
    price: 10, ebookPrice: 6, paperbackPrice: null, hardcoverPrice: null, audiobookPrice: null,
    hasEbook: true, hasPrint: false, hasAudiobook: false, files: [], submissionMetadata: null, ...over,
  };
}

describe("resolveFormatPrice / isFormatPurchasable", () => {
  test("audiobook never borrows the eBook or base price", () => {
    const b = book({ hasAudiobook: true, files: [{ kind: "AUDIOBOOK" }] });
    assert.equal(resolveFormatPrice(b, "audiobook"), null);
    assert.equal(isFormatPurchasable(b, "audiobook"), false);
  });
  test("audiobook needs the flag, a file and a price", () => {
    const priced = book({ hasAudiobook: true, audiobookPrice: "7.50", files: [{ kind: "AUDIOBOOK" }] });
    assert.equal(resolveFormatPrice(priced, "audiobook"), 7.5);
    assert.equal(isFormatPurchasable(priced, "audiobook"), true);
    assert.equal(isFormatPurchasable({ ...priced, files: [] }, "audiobook"), false);
    assert.equal(isFormatPurchasable({ ...priced, hasAudiobook: false }, "audiobook"), false);
  });
  test("eBook falls back to the base price; print needs hasPrint and a price", () => {
    assert.equal(resolveFormatPrice(book({ ebookPrice: null }), "ebook"), 10);
    assert.equal(isFormatPurchasable(book({ hasEbook: false }), "ebook"), false);
    const print = book({ hasPrint: true, paperbackPrice: 12 });
    assert.equal(isFormatPurchasable(print, "paperback"), true);
    assert.equal(isFormatPurchasable(print, "hardcover"), false);
  });
  test("legacy retail price in submission metadata still prices print", () => {
    const b = book({ hasPrint: true, submissionMetadata: { hardcoverEnabled: true, hardcoverRetailPrice: 18 } });
    assert.equal(resolveFormatPrice(b, "hardcover"), 18);
    assert.equal(isFormatPurchasable(b, "hardcover"), true);
  });
});
