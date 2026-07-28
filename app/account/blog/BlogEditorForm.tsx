"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBlogPost, updateBlogPost } from "@/actions/blog";
import { ImageUploadField } from "@/components/ImageUploadField";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";

export interface EditingBlogPost {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  content: string;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  shortSummary: string | null;
  categories: string[];
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  featured: boolean;
  allowComments: boolean;
  publishAt: string | null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toLocalDatetimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BlogEditorForm({ defaultAuthorName, editingPost, onDone }: {
  defaultAuthorName: string;
  editingPost?: EditingBlogPost;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [defaultFirst, defaultLast] = useMemo(() => {
    const parts = defaultAuthorName.trim().split(/\s+/);
    return [parts[0] ?? "", parts.slice(1).join(" ")];
  }, [defaultAuthorName]);

  const [coverImageUrl, setCoverImageUrl] = useState(editingPost?.coverImageUrl ?? "");
  const [imageAltText, setImageAltText] = useState(editingPost?.imageAltText ?? "");
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [subtitle, setSubtitle] = useState(editingPost?.subtitle ?? "");
  const [slug, setSlug] = useState(editingPost?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!editingPost);
  const [authorFirstName, setAuthorFirstName] = useState(editingPost?.authorFirstName ?? defaultFirst);
  const [authorLastName, setAuthorLastName] = useState(editingPost?.authorLastName ?? defaultLast);
  const [shortSummary, setShortSummary] = useState(editingPost?.shortSummary ?? "");
  const [content, setContent] = useState(editingPost?.content ?? "");
  const [categories, setCategories] = useState<string[]>(editingPost?.categories ?? []);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(editingPost?.tags ?? []);
  const [metaTitle, setMetaTitle] = useState(editingPost?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(editingPost?.metaDescription ?? "");
  const [seoKeywords, setSeoKeywords] = useState(editingPost?.seoKeywords ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(editingPost?.canonicalUrl ?? "");
  const [featured, setFeatured] = useState(editingPost?.featured ?? false);
  const [allowComments, setAllowComments] = useState(editingPost?.allowComments ?? true);
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeInputValue(editingPost?.publishAt ?? null));
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const readMin = Math.max(1, Math.round(words / 200));

  const applyWrap = useCallback((before: string, after: string = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    setContent((current) => {
      const selected = current.slice(start, end);
      const next = current.slice(0, start) + before + selected + after + current.slice(end);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, start + before.length + selected.length);
      });
      return next;
    });
  }, []);

  const applyLinePrefix = useCallback((prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    setContent((current) => {
      const lineStart = current.lastIndexOf("\n", start - 1) + 1;
      return current.slice(0, lineStart) + prefix + current.slice(lineStart);
    });
    requestAnimationFrame(() => ta.focus());
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) { setContent((current) => current + text); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    setContent((current) => current.slice(0, start) + text + current.slice(end));
    requestAnimationFrame(() => ta.focus());
  }, []);

  const insertLink = useCallback(() => {
    const url = window.prompt("Link URL:");
    if (url) applyWrap("[", `](${url})`);
  }, [applyWrap]);

  type ToolbarKind = "h1" | "h2" | "p" | "bold" | "italic" | "underline" | "strike" | "quote" | "ul" | "ol" | "link" | "image" | "video" | "table" | "code" | "note" | "hr";

  const handleToolbarClick = useCallback((kind: ToolbarKind) => {
    switch (kind) {
      case "h1": applyLinePrefix("# "); break;
      case "h2": applyLinePrefix("## "); break;
      case "p": applyLinePrefix(""); break;
      case "bold": applyWrap("**"); break;
      case "italic": applyWrap("*"); break;
      case "underline": applyWrap("<u>", "</u>"); break;
      case "strike": applyWrap("~~"); break;
      case "quote": applyLinePrefix("> "); break;
      case "ul": applyLinePrefix("- "); break;
      case "ol": applyLinePrefix("1. "); break;
      case "link": insertLink(); break;
      case "image": { const u = window.prompt("Image URL:"); if (u) insertAtCursor(`![](${u})`); break; }
      case "video": { const u = window.prompt("Video URL:"); if (u) insertAtCursor(`{{video: ${u}}}`); break; }
      case "table": insertAtCursor("\n| Column 1 | Column 2 |\n| --- | --- |\n| | |\n"); break;
      case "code": applyWrap("`"); break;
      case "note": applyLinePrefix("> **Note:** "); break;
      case "hr": insertAtCursor("\n\n---\n\n"); break;
    }
  }, [applyLinePrefix, applyWrap, insertLink, insertAtCursor]);

  const toolbar: { title: string; kind: ToolbarKind; svg: string }[] = [
    { title: "Heading 1", kind: "h1", svg: "H1" },
    { title: "Heading 2", kind: "h2", svg: "H2" },
    { title: "Paragraph", kind: "p", svg: "¶" },
    { title: "Bold", kind: "bold", svg: "B" },
    { title: "Italic", kind: "italic", svg: "I" },
    { title: "Underline", kind: "underline", svg: "U" },
    { title: "Strikethrough", kind: "strike", svg: "S" },
    { title: "Quote", kind: "quote", svg: "❝" },
    { title: "Bullet list", kind: "ul", svg: "•≡" },
    { title: "Numbered list", kind: "ol", svg: "1≡" },
    { title: "Link", kind: "link", svg: "🔗" },
    { title: "Image (paste an image URL)", kind: "image", svg: "🖼" },
    { title: "Video (paste a video URL)", kind: "video", svg: "▶" },
    { title: "Table", kind: "table", svg: "▦" },
    { title: "Code", kind: "code", svg: "<>" },
    { title: "Note", kind: "note", svg: "ℹ" },
    { title: "Horizontal rule", kind: "hr", svg: "—" },
  ];

  function toggleCategory(cat: string) {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  async function handleSave(submitForReview: boolean) {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const input = {
      title, subtitle, slug: effectiveSlug, content, coverImageUrl, imageAltText,
      authorFirstName, authorLastName, shortSummary, categories, tags,
      metaTitle, metaDescription, seoKeywords, canonicalUrl, featured, allowComments,
      scheduledAt: scheduledAt || undefined,
      submitForReview,
    };
    const res = editingPost ? await updateBlogPost(editingPost.id, input) : await saveBlogPost(input);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
    onDone?.();
  }

  const searchPreviewTitle = metaTitle.trim() || title.trim() || "Your post title";
  const searchPreviewDesc = metaDescription.trim() || "Your meta description will appear here.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Section 1 — Basic information */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-num">1</div>
          <div><h3>Basic information</h3><p>The title, image, and short copy readers see first.</p></div>
        </div>
        <ImageUploadField
          label="Featured image"
          recommendedSize="JPG, PNG, TIFF, BMP, GIF, HEIC, or WEBP"
          value={coverImageUrl}
          onChange={setCoverImageUrl}
        />
        <label className="field-label" htmlFor="blog-alt" style={{ marginTop: 14 }}>Image alt text</label>
        <input className="field" id="blog-alt" type="text" placeholder="Describe the image for screen readers and SEO" value={imageAltText} onChange={(e) => setImageAltText(e.target.value)} />
        <div className="field-hint">Read aloud by screen readers, and used if the image can&apos;t load.</div>

        <label className="field-label" htmlFor="blog-title" style={{ marginTop: 14 }}>Title</label>
        <input className="field" id="blog-title" type="text" placeholder="Give your post a title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="field-label" htmlFor="blog-subtitle" style={{ marginTop: 14 }}>Subtitle</label>
        <input className="field" id="blog-subtitle" type="text" placeholder="Optional supporting line shown under the title" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

        <label className="field-label" htmlFor="blog-slug" style={{ marginTop: 14 }}>URL slug</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>/blog/</span>
          <input
            className="field"
            id="blog-slug"
            type="text"
            value={effectiveSlug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
          />
        </div>
        <div className="field-hint">Auto-generated from the title; edit it any time before publishing.</div>

        <div className="form-grid-2" style={{ marginTop: 14 }}>
          <div>
            <label className="field-label" htmlFor="blog-author-first">Author first name</label>
            <input className="field" id="blog-author-first" type="text" value={authorFirstName} onChange={(e) => setAuthorFirstName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="blog-author-last">Author last name</label>
            <input className="field" id="blog-author-last" type="text" value={authorLastName} onChange={(e) => setAuthorLastName(e.target.value)} />
          </div>
        </div>

        <label className="field-label" htmlFor="blog-summary" style={{ marginTop: 14 }}>Short summary</label>
        <textarea className="field" id="blog-summary" rows={2} placeholder="One or two sentences that will show on the blog list" value={shortSummary} onChange={(e) => setShortSummary(e.target.value)} />
      </div>

      {/* Section 2 — Blog content */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-num">2</div>
          <div><h3>Blog content</h3><p>Write the post. Use the toolbar for formatting, tables, media, and more.</p></div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", background: "var(--cream)", borderRadius: 10, padding: "8px 14px", marginBottom: 10 }}>
          <span>{words} words</span>
          <span>{chars} characters</span>
          <span>{readMin} min read</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, border: "1px solid var(--line)", borderRadius: "10px 10px 0 0", padding: 8, background: "var(--cream)" }}>
          {toolbar.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onClick={() => handleToolbarClick(t.kind)}
              style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid transparent", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {t.svg}
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="field"
          rows={14}
          placeholder="Write your post..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{ borderRadius: "0 0 10px 10px", borderTop: "none" }}
        />
      </div>

      {/* Section 3 — Categories & tags */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-num">3</div>
          <div><h3>Categories &amp; tags</h3><p>Helps readers browse and helps search engines understand the post.</p></div>
        </div>
        <label className="field-label">Categories</label>
        <div className="blog-cat-pills">
          {BLOG_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`blog-cat-pill ${categories.includes(cat) ? "active" : ""}`}
              onClick={() => toggleCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="field-hint">Select as many as apply.</div>

        <label className="field-label" style={{ marginTop: 16 }}>Tags</label>
        <input
          className="field"
          type="text"
          placeholder="Type a tag and press Enter"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
        />
        <div className="field-hint">Free-form tags, start typing for suggestions.</div>
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {tags.map((t) => (
              <span key={t} className="status-pill status-draft" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Section 4 — SEO */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-num">4</div>
          <div><h3>SEO</h3><p>Controls how this post appears in search results and social shares.</p></div>
        </div>
        <label className="field-label" htmlFor="blog-meta-title">Meta title</label>
        <input className="field" id="blog-meta-title" type="text" placeholder="Defaults to the post title if left blank" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />

        <label className="field-label" htmlFor="blog-meta-desc" style={{ marginTop: 14 }}>Meta description</label>
        <textarea className="field" id="blog-meta-desc" rows={2} placeholder="Shown under the title in search results (about 150-160 characters)" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />

        <label className="field-label" htmlFor="blog-seo-keywords" style={{ marginTop: 14 }}>SEO keywords</label>
        <input className="field" id="blog-seo-keywords" type="text" placeholder="e.g. bedtime routine, picture books, read-aloud tips" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} />

        <label className="field-label" htmlFor="blog-canonical" style={{ marginTop: 14 }}>Canonical URL</label>
        <input className="field" id="blog-canonical" type="text" placeholder="Optional; only needed if this post is republished elsewhere" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} />
        <div className="field-hint">Open Graph and Twitter Card images use the featured image above automatically.</div>

        <label className="field-label" style={{ marginTop: 14 }}>Search preview</label>
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 16, background: "#fff" }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>thegoodchildbookstore.com › blog › {effectiveSlug || "your-post-slug"}</div>
          <div style={{ fontSize: 17, color: "#1a0dab", marginTop: 2 }}>{searchPreviewTitle}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{searchPreviewDesc}</div>
        </div>
      </div>

      {/* Section 5 — Publishing options */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-num">5</div>
          <div><h3>Publishing options</h3><p>Control when and how this post goes live.</p></div>
        </div>
        <div className="form-grid-2">
          <label className="toggle-row">
            <span className="toggle-switch"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /><span className="toggle-slider" /></span>
            <span>Featured article</span>
          </label>
          <label className="toggle-row">
            <span className="toggle-switch"><input type="checkbox" checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} /><span className="toggle-slider" /></span>
            <span>Allow comments</span>
          </label>
        </div>

        <label className="field-label" htmlFor="blog-schedule" style={{ marginTop: 14 }}>Schedule publication (optional)</label>
        <input className="field" id="blog-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <div className="field-hint">Leave blank to submit for review immediately instead of scheduling.</div>

        <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 14 }}>
          Once submitted, your post is checked by our support team before it appears on the Blog; this usually takes a day or two.
        </p>

        {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={() => handleSave(false)}>Save draft</button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide preview" : "Preview"}</button>
          <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={() => handleSave(true)}>Publish / submit for review</button>
          {onDone && <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={onDone}>Cancel</button>}
        </div>
      </div>

      {showPreview && (
        <div className="form-section" style={{ background: "var(--cream)" }}>
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- live preview of the featured image as it will appear
            <img src={coverImageUrl} alt={imageAltText || title} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />
          )}
          <h1 style={{ fontSize: 30, marginBottom: subtitle ? 4 : 12 }}>{title || "Untitled post"}</h1>
          {subtitle && <p style={{ fontSize: 15, color: "var(--ink-soft)", marginBottom: 12 }}>{subtitle}</p>}
          <div className="blog-meta" style={{ marginBottom: 16 }}>
            <span>by {authorFirstName} {authorLastName}</span>
          </div>
          <div className="blog-article-body blog-article-dropcap">
            {content.split(/\n\s*\n/).filter((p) => p.trim()).map((para, i) => <p key={i} style={{ whiteSpace: "pre-wrap" }}>{para.trim()}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
