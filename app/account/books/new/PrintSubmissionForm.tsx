"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook } from "@/actions/submissions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { FileUploadField } from "@/components/FileUploadField";
import { ButtonGroup } from "@/components/ButtonGroup";
import { CoverWrapPreview } from "@/components/CoverWrapPreview";
import { Ean13Barcode } from "@/components/Ean13Barcode";
import { LULU_CONFIG, buildPodPackageId } from "@/lib/lulu-config";
import { computePrintPricing } from "@/lib/lulu-pricing";
import { SectionHeader, Card } from "./shared";

const CATEGORIES = ["Picture books", "Bedtime stories", "Middle grade", "Educational"];
const GENRES = ["Adventure", "Fantasy", "Animal Story", "Fairy Tale", "Poetry", "Educational"];
const AGE_RANGES = ["0-2 years", "3-5 years", "6-8 years", "9-12 years", "12-15 years"];
const READING_LEVELS = ["Pre-reader", "Beginner", "Early Reader", "Independent Reader", "Fluent Reader"];
const LANGUAGES = ["English", "Spanish", "French", "Swahili"];
const SHIPPING_LEVELS = ["Mail (slowest, cheapest)", "Priority Mail", "Ground", "Expedited", "Express"];

const PAPERBACK_BINDINGS = LULU_CONFIG.bindings.filter((b) => !b.hardcover);

/**
 * Converted to match the exact reference design provided: "Submit a
 * print copy" — a dedicated print-on-demand workflow fulfilled through
 * Lulu, distinct from the eBook form. Paperback and Hardcover are
 * separate printable editions of the same title (each with its own
 * price, POD package ID, and cost/royalty breakdown), a real cover-wrap
 * preview with toggleable margin/bleed/fold/trim guides, and a real,
 * scannable EAN-13 barcode generated from the ISBN.
 *
 * Honesty note on the Pricing section: Lulu's real printing cost comes
 * from their live Print API cost-calculation endpoint, which needs real
 * API credentials and network access this environment doesn't have —
 * the numbers shown are a documented, labeled estimate (see
 * lib/lulu-pricing.ts), not a live quote.
 */
export function PrintSubmissionForm() {
  const router = useRouter();

  // Section 1
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [edition, setEdition] = useState("");
  const [isbn, setIsbn] = useState("978-1-59299-541-7");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [publicationDate, setPublicationDate] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [ageGroup, setAgeGroup] = useState(AGE_RANGES[0]);
  const [readingLevel, setReadingLevel] = useState(READING_LEVELS[0]);
  const [description, setDescription] = useState("");

  // Section 2
  const [authorFirstName, setAuthorFirstName] = useState("");
  const [authorLastName, setAuthorLastName] = useState("");
  const [coAuthors, setCoAuthors] = useState("");
  const [illustrator, setIllustrator] = useState("");
  const [editor, setEditor] = useState("");
  const [translator, setTranslator] = useState("");

  // Section 3
  const [printReadyPdfFileId, setPrintReadyPdfFileId] = useState<string | undefined>();
  const [frontCoverImageUrl, setFrontCoverImageUrl] = useState("");
  const [customBackCoverPdfFileId, setCustomBackCoverPdfFileId] = useState<string | undefined>();

  // Section 4
  const [paperbackEnabled, setPaperbackEnabled] = useState(true);
  const [hardcoverEnabled, setHardcoverEnabled] = useState(true);

  // Section 5
  const [trimCode, setTrimCode] = useState(LULU_CONFIG.trimSizes[2].code);
  const [paperbackBinding, setPaperbackBinding] = useState(PAPERBACK_BINDINGS[0].code);
  const [interiorColor, setInteriorColor] = useState(LULU_CONFIG.interiorColors[0].code);
  const [printQuality, setPrintQuality] = useState(LULU_CONFIG.printQualities[0].code);
  const [paperType, setPaperType] = useState(LULU_CONFIG.paperTypes[0].code);
  const [coverFinish, setCoverFinish] = useState(LULU_CONFIG.coverFinishes[0].code);
  const [linenColor, setLinenColor] = useState(LULU_CONFIG.linenColors[1].code);
  const [foilColor, setFoilColor] = useState(LULU_CONFIG.foilColors[1].code);
  const [foilStampTitleText, setFoilStampTitleText] = useState("");
  const [foilStampAuthorText, setFoilStampAuthorText] = useState("");

  // Section 6
  const [paperbackRetailPrice, setPaperbackRetailPrice] = useState("0");
  const [hardcoverRetailPrice, setHardcoverRetailPrice] = useState("0");

  // Section 7
  const [contactEmail, setContactEmail] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [stateRegionCode, setStateRegionCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shippingLevel, setShippingLevel] = useState(SHIPPING_LEVELS[0]);

  // Section 8
  const [sellThroughWebsite, setSellThroughWebsite] = useState(true);
  const [luluGlobalDistribution, setLuluGlobalDistribution] = useState(true);
  const [privatePrinting, setPrivatePrinting] = useState(false);
  const [affiliateEligiblePrint, setAffiliateEligiblePrint] = useState(false);
  const [promotionalCampaignEligible, setPromotionalCampaignEligible] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const foilCharsUsed = foilStampTitleText.length + foilStampAuthorText.length;

  const paperbackPodId = buildPodPackageId({
    trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: paperbackBinding, paperCode: paperType, finishCode: coverFinish, linenCode: "X", foilCode: "X",
  });
  const hardcoverPodId = buildPodPackageId({
    trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: "LW", paperCode: paperType, finishCode: coverFinish, linenCode: linenColor, foilCode: foilColor,
  });

  const paperbackPricing = computePrintPricing(Number(paperbackRetailPrice) || 0, paperbackBinding as "PB" | "CO");
  const hardcoverPricing = computePrintPricing(Number(hardcoverRetailPrice) || 0, "LW");

  async function handleSubmit(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await submitBook({
      title,
      subtitle,
      isbn,
      description,
      price: paperbackEnabled ? Number(paperbackRetailPrice) || 0 : Number(hardcoverRetailPrice) || 0,
      ageGroup,
      category,
      genre,
      language,
      coverImageUrl: frontCoverImageUrl,
      manuscriptFileId: printReadyPdfFileId,
      formats: { ebook: false, print: true, audiobook: false },
      metadata: {
        authorFirstName,
        authorLastName,
        edition,
        seriesName,
        publicationDate,
        coAuthors,
        illustrator,
        editor,
        translator,
        readingLevel,
        currency: "USD",
        taxSetting: "Calculate automatically by customer location",
        worldwideRights: true,
        licenseType: "All rights reserved",
        sellOnStore: sellThroughWebsite,
        includeInPromotions: promotionalCampaignEligible,
        featuredRequest: false,
        allowDiscounts: true,
        allowBundles: true,
        affiliateEnabled: affiliateEligiblePrint,
        paperbackEnabled,
        hardcoverEnabled,
        paperbackRetailPrice: Number(paperbackRetailPrice) || 0,
        hardcoverRetailPrice: Number(hardcoverRetailPrice) || 0,
        foilStampTitleText,
        foilStampAuthorText,
        printReadyPdfFileId,
        frontCoverImageUrl,
        customBackCoverPdfFileId,
        contactEmail,
        streetAddress,
        city,
        countryCode,
        stateRegionCode,
        postalCode,
        phoneNumber,
        shippingLevel,
        sellThroughWebsite,
        luluGlobalDistribution,
        privatePrinting,
        affiliateEligiblePrint,
        promotionalCampaignEligible,
        interiorColor,
        printQuality,
        binding: paperbackEnabled ? paperbackBinding : "LW",
        paperType,
        coverFinish,
        linenColor,
        foilColor,
        trimSizeCode: trimCode,
        podPackageId: paperbackEnabled ? paperbackPodId : hardcoverPodId,
      },
      submitForReview,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.push("/account/books");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Section 1 */}
      <Card>
        <SectionHeader n={1} title="Book information" sub="Core bibliographic details for the print edition." />
        <label className="field-label" htmlFor="p-title">Book title</label>
        <input className="field" id="p-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="p-subtitle">Subtitle</label>
            <input className="field" id="p-subtitle" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-series">Series</label>
            <input className="field" id="p-series" type="text" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="p-edition">Edition</label>
            <input className="field" id="p-edition" type="text" value={edition} onChange={(e) => setEdition(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-isbn">ISBN</label>
            <input className="field" id="p-isbn" type="text" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-lang">Language</label>
            <select className="field" id="p-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <label className="field-label" htmlFor="p-pubdate">Publication date</label>
        <input className="field" id="p-pubdate" type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="p-category">Category</label>
            <select className="field" id="p-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="p-genre">Genre</label>
            <select className="field" id="p-genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="p-age">Age group</label>
            <select className="field" id="p-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <label className="field-label" htmlFor="p-readinglevel">Reading level</label>
        <select className="field" id="p-readinglevel" value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}>
          {READING_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="field-label" htmlFor="p-desc">Book description</label>
        <textarea className="field" id="p-desc" rows={4} placeholder="A short back-cover description of the book…" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Card>

      {/* Section 2 */}
      <Card>
        <SectionHeader n={2} title="Author information" sub="Everyone credited on this edition." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="p-authfirst">Primary author: first name</label>
            <input className="field" id="p-authfirst" type="text" value={authorFirstName} onChange={(e) => setAuthorFirstName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-authlast">Primary author: last name</label>
            <input className="field" id="p-authlast" type="text" value={authorLastName} onChange={(e) => setAuthorLastName(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="p-coauthors">Co-author(s)</label>
        <input className="field" id="p-coauthors" type="text" value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="p-illustrator">Illustrator</label>
            <input className="field" id="p-illustrator" type="text" value={illustrator} onChange={(e) => setIllustrator(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-editor">Editor</label>
            <input className="field" id="p-editor" type="text" value={editor} onChange={(e) => setEditor(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-translator">Translator</label>
            <input className="field" id="p-translator" type="text" value={translator} onChange={(e) => setTranslator(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Section 3 */}
      <Card>
        <SectionHeader n={3} title="Files" sub="The central upload area for all print assets. Print-ready files are validated automatically on upload." />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <FileUploadField
            label="Print-Ready PDF"
            sizeHint="The complete interior pages of the book"
            allowedTypes={["application/pdf"]}
            accept=".pdf"
            onUploaded={(ids) => setPrintReadyPdfFileId(ids[0])}
          />
          <ImageUploadField label="Front Cover Only" recommendedSize="PNG or JPEG — only the front cover artwork is required" value={frontCoverImageUrl} onChange={setFrontCoverImageUrl} />
          <FileUploadField
            label="Custom Back Cover"
            sizeHint="PDF — complete wraparound cover (front, spine, back)"
            allowedTypes={["application/pdf"]}
            accept=".pdf"
            onUploaded={(ids) => setCustomBackCoverPdfFileId(ids[0])}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
          Upload only your professionally designed front cover. The matching spine and back cover are generated
          automatically from the dominant colour palette, book description, and ISBN already entered.
        </p>
        <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          File type and size are checked immediately. Resolution, bleed, trim-size match, and embedded fonts are
          checked by our print partner once the job is submitted; any issues are reported back before printing
          begins.
        </p>
      </Card>

      {/* Section 4 */}
      <Card>
        <SectionHeader n={4} title="Publication format" sub="Choose Paperback, Hardcover, or both as separate printable editions of this title." />
        <div style={{ display: "flex", gap: 32 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={paperbackEnabled} onChange={(e) => setPaperbackEnabled(e.target.checked)} /> Paperback
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={hardcoverEnabled} onChange={(e) => setHardcoverEnabled(e.target.checked)} /> Hardcover (Linen Wrap)
          </label>
        </div>
      </Card>

      {/* Section 5 */}
      <Card>
        <SectionHeader n={5} title="Book specifications" sub="Every option here maps directly to a Lulu Print API POD Package code." />
        <label className="field-label">Trim size</label>
        <ButtonGroup options={LULU_CONFIG.trimSizes} value={trimCode} onChange={setTrimCode} />
        {paperbackEnabled && (
          <>
            <label className="field-label">Paperback binding</label>
            <ButtonGroup options={PAPERBACK_BINDINGS} value={paperbackBinding} onChange={setPaperbackBinding} />
          </>
        )}
        <label className="field-label">Interior color</label>
        <ButtonGroup options={LULU_CONFIG.interiorColors} value={interiorColor} onChange={setInteriorColor} />
        <label className="field-label">Print quality</label>
        <ButtonGroup options={LULU_CONFIG.printQualities} value={printQuality} onChange={setPrintQuality} />
        <label className="field-label">Paper type</label>
        <ButtonGroup options={LULU_CONFIG.paperTypes} value={paperType} onChange={setPaperType} />
        {paperbackEnabled && (
          <>
            <label className="field-label">Cover finish (paperback/coil)</label>
            <ButtonGroup options={LULU_CONFIG.coverFinishes} value={coverFinish} onChange={setCoverFinish} />
          </>
        )}
        {hardcoverEnabled && (
          <>
            <label className="field-label">Linen wrap color (hardcover)</label>
            <ButtonGroup options={LULU_CONFIG.linenColors.filter((l) => l.code !== "X")} value={linenColor} onChange={setLinenColor} />
            <label className="field-label">Foil stamp color (hardcover spine)</label>
            <ButtonGroup options={LULU_CONFIG.foilColors.filter((f) => f.code !== "X")} value={foilColor} onChange={setFoilColor} />
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor="p-foiltitle">Foil stamp: title text</label>
                <input className="field" id="p-foiltitle" type="text" value={foilStampTitleText} onChange={(e) => setFoilStampTitleText(e.target.value.slice(0, 42 - foilStampAuthorText.length))} />
              </div>
              <div>
                <label className="field-label" htmlFor="p-foilauthor">Foil stamp: author text</label>
                <input className="field" id="p-foilauthor" type="text" value={foilStampAuthorText} onChange={(e) => setFoilStampAuthorText(e.target.value.slice(0, 42 - foilStampTitleText.length))} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              Title and author foil text combined cannot exceed 42 characters ({foilCharsUsed}/42 used). Roman characters only.
            </p>
          </>
        )}
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>
          Page count: upload a print-ready or interior PDF to calculate
        </p>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {paperbackEnabled && (
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              Paperback POD Package ID: <code>{paperbackPodId}</code>
            </p>
          )}
          {hardcoverEnabled && (
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
              Hardcover POD Package ID: <code>{hardcoverPodId}</code>
            </p>
          )}
        </div>
      </Card>

      {/* Section 6 */}
      <Card>
        <SectionHeader n={6} title="Pricing" sub="Each format is priced and printed as a separate edition." />
        <div className="form-grid-2">
          {paperbackEnabled && (
            <div>
              <label className="field-label" htmlFor="p-pbprice">Paperback retail price</label>
              <input className="field" id="p-pbprice" type="number" step={0.01} value={paperbackRetailPrice} onChange={(e) => setPaperbackRetailPrice(e.target.value)} />
            </div>
          )}
          {hardcoverEnabled && (
            <div>
              <label className="field-label" htmlFor="p-hcprice">Hardcover retail price</label>
              <input className="field" id="p-hcprice" type="number" step={0.01} value={hardcoverRetailPrice} onChange={(e) => setHardcoverRetailPrice(e.target.value)} />
            </div>
          )}
        </div>
        {hardcoverEnabled && (
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div><div className="stat-label">Hardcover printing cost</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.printingCost.toFixed(2)}</div><div className="stat-sub">Via Lulu print partner</div></div>
            <div><div className="stat-label">Company revenue</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.companyRevenue.toFixed(2)}</div><div className="stat-sub">25% of retail price</div></div>
            <div><div className="stat-label">Author profit</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.authorProfit.toFixed(2)}</div><div className="stat-sub">After printing cost</div></div>
            <div><div className="stat-label">Estimated royalty</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.estimatedRoyalty.toFixed(2)}</div><div className="stat-sub">Per copy sold</div></div>
          </div>
        )}
        {paperbackEnabled && (
          <div className="form-grid-2" style={{ marginTop: 12 }}>
            <div><div className="stat-label">Paperback printing cost</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.printingCost.toFixed(2)}</div><div className="stat-sub">Via Lulu print partner</div></div>
            <div><div className="stat-label">Company revenue</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.companyRevenue.toFixed(2)}</div><div className="stat-sub">25% of retail price</div></div>
            <div><div className="stat-label">Author profit</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.authorProfit.toFixed(2)}</div><div className="stat-sub">After printing cost</div></div>
            <div><div className="stat-label">Estimated royalty</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.estimatedRoyalty.toFixed(2)}</div><div className="stat-sub">Per copy sold</div></div>
          </div>
        )}
      </Card>

      {/* Section 7 */}
      <Card>
        <SectionHeader n={7} title="Shipping & contact" sub="Required by the print API to calculate shipping cost and route the job." />
        <label className="field-label" htmlFor="p-email">Contact email</label>
        <input className="field" id="p-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="p-street">Street address</label>
            <input className="field" id="p-street" type="text" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-city">City</label>
            <input className="field" id="p-city" type="text" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <label className="field-label" htmlFor="p-country">Country code</label>
            <input className="field" id="p-country" type="text" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-state">State/region code</label>
            <input className="field" id="p-state" type="text" value={stateRegionCode} onChange={(e) => setStateRegionCode(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-postal">Postal code</label>
            <input className="field" id="p-postal" type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="p-phone">Phone number</label>
        <input className="field" id="p-phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
        <label className="field-label" htmlFor="p-shiplevel">Shipping level</label>
        <select className="field" id="p-shiplevel" value={shippingLevel} onChange={(e) => setShippingLevel(e.target.value)}>
          {SHIPPING_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Card>

      {/* Section 8 */}
      <Card>
        <SectionHeader n={8} title="Distribution" sub="Where this print edition can be sold." />
        <div className="form-grid-2">
          <div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={sellThroughWebsite} onChange={(e) => setSellThroughWebsite(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Sell through website</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={privatePrinting} onChange={(e) => setPrivatePrinting(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Private printing (author copies only)</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={promotionalCampaignEligible} onChange={(e) => setPromotionalCampaignEligible(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Promotional campaign eligible</span>
            </div>
          </div>
          <div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={luluGlobalDistribution} onChange={(e) => setLuluGlobalDistribution(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Lulu global distribution</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={affiliateEligiblePrint} onChange={(e) => setAffiliateEligiblePrint(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Affiliate eligible</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 9 */}
      <Card>
        <SectionHeader n={9} title="Book Preview" sub="Use this preview window to see how your book will look. Carefully review the margin, bleed, and fold areas to ensure your book will print correctly." />
        <CoverWrapPreview description={description} isbn={isbn} />
      </Card>

      {/* Section 10 */}
      <Card>
        <SectionHeader n={10} title="ISBN Barcode" sub="Generated automatically from the ISBN assigned to this title." />
        <Ean13Barcode isbn={isbn} />
      </Card>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <div>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={() => handleSubmit(true)}>
          {submitting ? "Submitting…" : "Submit print copy"}
        </button>
      </div>
    </div>
  );
}
