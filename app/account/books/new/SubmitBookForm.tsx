"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook } from "@/actions/submissions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { LULU_CONFIG, buildPodPackageId } from "@/lib/lulu-config";

const AGE_RANGES = ["0-2", "3-5", "6-8", "9-12", "12-15"];
const GENRES = ["Picture Book", "Bedtime Story", "Fairy Tale", "Fantasy", "Adventure", "Animal Story", "Educational", "Poetry", "Middle Grade Fiction"];
const READING_LEVELS = ["Pre-reader", "Beginner", "Early Reader", "Independent Reader", "Fluent Reader"];
const LICENSE_TYPES = ["All Rights Reserved", "Exclusive Distribution", "Non-Exclusive Distribution"];
const CURRENCIES = ["USD", "EUR", "GBP"];
const TAX_SETTINGS = ["Standard", "Tax Exempt", "Reduced Rate"];
const FILE_TYPES = ["EPUB", "PDF", "MOBI"];

/**
 * Converted from the original's actual submission form fields
 * (collectSubmissionFormData(), the-good-child-bookstore_54_1.html:
 * 10651-10689) — every field it collected, organized into sections.
 * Not replicated: the live print-cover-wrap preview and full Lulu
 * print-configuration UI (see actions/submissions.ts for what's covered
 * vs. deferred).
 */
export function SubmitBookForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [backCoverDescription, setBackCoverDescription] = useState("");
  const [price, setPrice] = useState(12.99);
  const [ageGroup, setAgeGroup] = useState(AGE_RANGES[1]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [ebook, setEbook] = useState(true);
  const [print, setPrint] = useState(false);
  const [audiobook, setAudiobook] = useState(false);

  const [authorFirstName, setAuthorFirstName] = useState("");
  const [authorLastName, setAuthorLastName] = useState("");
  const [coAuthors, setCoAuthors] = useState("");
  const [illustrator, setIllustrator] = useState("");
  const [editor, setEditor] = useState("");
  const [translator, setTranslator] = useState("");
  const [authorBio, setAuthorBio] = useState("");

  const [edition, setEdition] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [seriesNumber, setSeriesNumber] = useState("");
  const [language, setLanguage] = useState("en");
  const [publisher, setPublisher] = useState("");
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()));

  const [subgenre, setSubgenre] = useState("");
  const [readingLevel, setReadingLevel] = useState(READING_LEVELS[2]);
  const [schoolGrade, setSchoolGrade] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [educationalBenefits, setEducationalBenefits] = useState("");

  const [discountPrice, setDiscountPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxSetting, setTaxSetting] = useState(TAX_SETTINGS[0]);
  const [worldwideRights, setWorldwideRights] = useState(true);
  const [countryRestrictions, setCountryRestrictions] = useState("");
  const [copyrightHolder, setCopyrightHolder] = useState("");
  const [licenseType, setLicenseType] = useState(LICENSE_TYPES[0]);

  const [sellOnStore, setSellOnStore] = useState(true);
  const [includeInPromotions, setIncludeInPromotions] = useState(true);
  const [featuredRequest, setFeaturedRequest] = useState(false);
  const [allowDiscounts, setAllowDiscounts] = useState(true);
  const [allowBundles, setAllowBundles] = useState(true);
  const [affiliateEnabled, setAffiliateEnabled] = useState(true);

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  const [fileType, setFileType] = useState(FILE_TYPES[0]);
  const [narrator, setNarrator] = useState("");

  const [trimCode, setTrimCode] = useState(LULU_CONFIG.trimSizes[2].code);
  const [interiorColor, setInteriorColor] = useState(LULU_CONFIG.interiorColors[0].code);
  const [printQuality, setPrintQuality] = useState(LULU_CONFIG.printQualities[0].code);
  const [binding, setBinding] = useState(LULU_CONFIG.bindings[0].code);
  const [paperType, setPaperType] = useState(LULU_CONFIG.paperTypes[0].code);
  const [coverFinish, setCoverFinish] = useState(LULU_CONFIG.coverFinishes[0].code);
  const [linenColor, setLinenColor] = useState(LULU_CONFIG.linenColors[0].code);
  const [foilColor, setFoilColor] = useState(LULU_CONFIG.foilColors[0].code);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await submitBook({
      title,
      subtitle,
      description,
      backCoverDescription,
      price,
      ageGroup,
      genre,
      language,
      coverImageUrl,
      formats: { ebook, print, audiobook },
      metadata: {
        authorFirstName,
        authorLastName,
        edition,
        seriesName,
        seriesNumber: seriesNumber ? Number(seriesNumber) : undefined,
        publisher,
        copyrightYear: copyrightYear ? Number(copyrightYear) : undefined,
        coAuthors,
        illustrator,
        editor,
        translator,
        authorBio,
        subgenre,
        readingLevel,
        schoolGrade,
        curriculum,
        learningObjectives,
        educationalBenefits,
        discountPrice: discountPrice ? Number(discountPrice) : undefined,
        promoPrice: promoPrice ? Number(promoPrice) : undefined,
        currency,
        taxSetting,
        worldwideRights,
        countryRestrictions,
        copyrightHolder,
        licenseType,
        sellOnStore,
        includeInPromotions,
        featuredRequest,
        allowDiscounts,
        allowBundles,
        affiliateEnabled,
        seoTitle,
        seoDescription,
        keywords,
        fileType: ebook ? fileType : undefined,
        narrator: audiobook ? narrator : undefined,
        interiorColor: print ? interiorColor : undefined,
        printQuality: print ? printQuality : undefined,
        binding: print ? binding : undefined,
        paperType: print ? paperType : undefined,
        coverFinish: print ? coverFinish : undefined,
        linenColor: print && binding === "LW" ? linenColor : undefined,
        foilColor: print && binding === "LW" ? foilColor : undefined,
        trimSizeCode: print ? trimCode : undefined,
        podPackageId: print
          ? buildPodPackageId({
              trimCode,
              colorCode: interiorColor,
              qualityCode: printQuality,
              bindingCode: binding,
              paperCode: paperType,
              finishCode: coverFinish,
              linenCode: linenColor,
              foilCode: foilColor,
            })
          : undefined,
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
    <form
      className="form-section"
      style={{ background: "var(--cream)", maxWidth: 720 }}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(true);
      }}
    >
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Basic info</h3>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-title">Title</label>
          <input className="field" id="sub-title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-subtitle">Subtitle</label>
          <input className="field" id="sub-subtitle" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-first">Author first name</label>
          <input className="field" id="sub-first" type="text" value={authorFirstName} onChange={(e) => setAuthorFirstName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-last">Author last name</label>
          <input className="field" id="sub-last" type="text" value={authorLastName} onChange={(e) => setAuthorLastName(e.target.value)} />
        </div>
      </div>

      <label className="field-label" htmlFor="sub-desc">Short description</label>
      <textarea className="field" id="sub-desc" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} />
      <label className="field-label" htmlFor="sub-back-desc">Back cover description</label>
      <textarea className="field" id="sub-back-desc" rows={3} value={backCoverDescription} onChange={(e) => setBackCoverDescription(e.target.value)} />

      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-price">Price (USD)</label>
          <input className="field" id="sub-price" type="number" min={0.99} step={0.01} required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-age">Age range</label>
          <select className="field" id="sub-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            {AGE_RANGES.map((a) => <option key={a} value={a}>{a} years</option>)}
          </select>
        </div>
      </div>

      <ImageUploadField label="Cover image" recommendedSize="Recommended 1600×2400px" value={coverImageUrl} onChange={setCoverImageUrl} />

      <label className="field-label">Available formats</label>
      <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={ebook} onChange={(e) => setEbook(e.target.checked)} /> eBook
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={print} onChange={(e) => setPrint(e.target.checked)} /> Print (paperback/hardcover)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={audiobook} onChange={(e) => setAudiobook(e.target.checked)} /> Audiobook
        </label>
      </div>

      {ebook && (
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="sub-filetype">eBook file type</label>
            <select className="field" id="sub-filetype" value={fileType} onChange={(e) => setFileType(e.target.value)}>
              {FILE_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div />
        </div>
      )}
      {print && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
            Real Lulu print-on-demand configuration — trim size, ink, quality, binding, paper, and finish, exactly
            matching Lulu&apos;s own print-job specification.
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="sub-trim">Trim size</label>
              <select className="field" id="sub-trim" value={trimCode} onChange={(e) => setTrimCode(e.target.value)}>
                {LULU_CONFIG.trimSizes.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="sub-color">Interior color</label>
              <select className="field" id="sub-color" value={interiorColor} onChange={(e) => setInteriorColor(e.target.value)}>
                {LULU_CONFIG.interiorColors.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="sub-quality">Print quality</label>
              <select className="field" id="sub-quality" value={printQuality} onChange={(e) => setPrintQuality(e.target.value)}>
                {LULU_CONFIG.printQualities.map((q) => <option key={q.code} value={q.code}>{q.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="sub-binding">Binding</label>
              <select className="field" id="sub-binding" value={binding} onChange={(e) => setBinding(e.target.value)}>
                {LULU_CONFIG.bindings.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor="sub-paper">Paper type</label>
              <select className="field" id="sub-paper" value={paperType} onChange={(e) => setPaperType(e.target.value)}>
                {LULU_CONFIG.paperTypes.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="sub-finish">Cover finish</label>
              <select className="field" id="sub-finish" value={coverFinish} onChange={(e) => setCoverFinish(e.target.value)}>
                {LULU_CONFIG.coverFinishes.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
              </select>
            </div>
          </div>
          {binding === "LW" && (
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor="sub-linen">Linen wrap color</label>
                <select className="field" id="sub-linen" value={linenColor} onChange={(e) => setLinenColor(e.target.value)}>
                  {LULU_CONFIG.linenColors.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="sub-foil">Foil stamp color</label>
                <select className="field" id="sub-foil" value={foilColor} onChange={(e) => setFoilColor(e.target.value)}>
                  {LULU_CONFIG.foilColors.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="field-hint" style={{ marginTop: 4 }}>
            Lulu package ID: <code>{buildPodPackageId({ trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: binding, paperCode: paperType, finishCode: coverFinish, linenCode: linenColor, foilCode: foilColor })}</code>
          </div>
        </div>
      )}
      {audiobook && (
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="sub-narrator">Narrator</label>
            <input className="field" id="sub-narrator" type="text" value={narrator} onChange={(e) => setNarrator(e.target.value)} />
          </div>
          <div />
        </div>
      )}

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Contributors</h3>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-coauthors">Co-authors</label>
          <input className="field" id="sub-coauthors" type="text" value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-illustrator">Illustrator</label>
          <input className="field" id="sub-illustrator" type="text" value={illustrator} onChange={(e) => setIllustrator(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-editor">Editor</label>
          <input className="field" id="sub-editor" type="text" value={editor} onChange={(e) => setEditor(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-translator">Translator</label>
          <input className="field" id="sub-translator" type="text" value={translator} onChange={(e) => setTranslator(e.target.value)} />
        </div>
      </div>
      <label className="field-label" htmlFor="sub-authorbio">Author bio</label>
      <textarea className="field" id="sub-authorbio" rows={2} value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} />

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Edition &amp; series</h3>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-edition">Edition</label>
          <input className="field" id="sub-edition" type="text" value={edition} onChange={(e) => setEdition(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-language">Language</label>
          <input className="field" id="sub-language" type="text" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-series">Series name</label>
          <input className="field" id="sub-series" type="text" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-seriesnum">Series number</label>
          <input className="field" id="sub-seriesnum" type="number" value={seriesNumber} onChange={(e) => setSeriesNumber(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-publisher">Publisher</label>
          <input className="field" id="sub-publisher" type="text" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-copyrightyear">Copyright year</label>
          <input className="field" id="sub-copyrightyear" type="number" value={copyrightYear} onChange={(e) => setCopyrightYear(e.target.value)} />
        </div>
      </div>

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Categorization</h3>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-genre">Genre</label>
          <select className="field" id="sub-genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="sub-subgenre">Subgenre</label>
          <input className="field" id="sub-subgenre" type="text" value={subgenre} onChange={(e) => setSubgenre(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-readinglevel">Reading level</label>
          <select className="field" id="sub-readinglevel" value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}>
            {READING_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="sub-schoolgrade">School grade</label>
          <input className="field" id="sub-schoolgrade" type="text" value={schoolGrade} onChange={(e) => setSchoolGrade(e.target.value)} />
        </div>
      </div>
      <label className="field-label" htmlFor="sub-curriculum">Curriculum tie-in</label>
      <input className="field" id="sub-curriculum" type="text" value={curriculum} onChange={(e) => setCurriculum(e.target.value)} />
      <label className="field-label" htmlFor="sub-learningobj">Learning objectives</label>
      <textarea className="field" id="sub-learningobj" rows={2} value={learningObjectives} onChange={(e) => setLearningObjectives(e.target.value)} />
      <label className="field-label" htmlFor="sub-edubenefits">Educational benefits</label>
      <textarea className="field" id="sub-edubenefits" rows={2} value={educationalBenefits} onChange={(e) => setEducationalBenefits(e.target.value)} />

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Pricing &amp; rights</h3>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-discountprice">Discount price</label>
          <input className="field" id="sub-discountprice" type="number" step={0.01} value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-promoprice">Promo price</label>
          <input className="field" id="sub-promoprice" type="number" step={0.01} value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-currency">Currency</label>
          <select className="field" id="sub-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="sub-tax">Tax setting</label>
          <select className="field" id="sub-tax" value={taxSetting} onChange={(e) => setTaxSetting(e.target.value)}>
            {TAX_SETTINGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor="sub-copyrightholder">Copyright holder</label>
          <input className="field" id="sub-copyrightholder" type="text" value={copyrightHolder} onChange={(e) => setCopyrightHolder(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="sub-license">License type</label>
          <select className="field" id="sub-license" value={licenseType} onChange={(e) => setLicenseType(e.target.value)}>
            {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, marginBottom: 10 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={worldwideRights} onChange={(e) => setWorldwideRights(e.target.checked)} /> Worldwide rights
      </label>
      {!worldwideRights && (
        <>
          <label className="field-label" htmlFor="sub-countryrestrict">Country restrictions</label>
          <input className="field" id="sub-countryrestrict" type="text" placeholder="e.g. US, CA, UK" value={countryRestrictions} onChange={(e) => setCountryRestrictions(e.target.value)} />
        </>
      )}

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Marketing</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Sell on store", value: sellOnStore, set: setSellOnStore },
          { label: "Include in promotions", value: includeInPromotions, set: setIncludeInPromotions },
          { label: "Request featured placement", value: featuredRequest, set: setFeaturedRequest },
          { label: "Allow discounts", value: allowDiscounts, set: setAllowDiscounts },
          { label: "Allow bundles", value: allowBundles, set: setAllowBundles },
          { label: "Enable affiliate promotion", value: affiliateEnabled, set: setAffiliateEnabled },
        ].map((t) => (
          <label key={t.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={t.value} onChange={(e) => t.set(e.target.checked)} /> {t.label}
          </label>
        ))}
      </div>

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>SEO</h3>
      <label className="field-label" htmlFor="sub-seotitle">SEO title</label>
      <input className="field" id="sub-seotitle" type="text" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
      <label className="field-label" htmlFor="sub-seodesc">SEO description</label>
      <textarea className="field" id="sub-seodesc" rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
      <label className="field-label" htmlFor="sub-keywords">Keywords</label>
      <input className="field" id="sub-keywords" type="text" placeholder="comma, separated, keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={() => handleSubmit(false)}>
          Save as draft
        </button>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
