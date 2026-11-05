"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { blogSeoScore } from "@/lib/blog/seo-score";
import { findDuplicateFocusKeyword } from "@/actions/blog-author";

/**
 * Live SEO help inside the blog editor: a score out of 100 with plain advice, the character counters and a Google-style preview.
 * It only reads what the writer has typed; nothing here is saved by itself.
 */
export function BlogSeoPanel(props: {
  postId?: string;
  title: string;
  slug: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  imageAlt: string;
  hasImage: boolean;
  focus: string;
}) {
  const host = useSyncExternalStore(() => () => undefined, () => window.location.host, () => "yoursite.com");
  // The answer is remembered together with the keyword it was asked for, so an old answer is never shown for a new keyword.
  const [found, setFound] = useState<{ focus: string; list: { title: string; slug: string; mine: boolean }[] }>({ focus: "", list: [] });
  useEffect(() => {
    const focus = props.focus.trim();
    if (focus.length < 3) return;
    const t = setTimeout(() => {
      findDuplicateFocusKeyword(focus, props.postId).then((list) => setFound({ focus, list })).catch(() => setFound({ focus, list: [] }));
    }, 600);
    return () => clearTimeout(t);
  }, [props.focus, props.postId]);
  const dupes = found.focus === props.focus.trim() ? found.list : [];

  const result = useMemo(() => blogSeoScore({
    title: props.title, slug: props.slug, content: props.content, metaTitle: props.metaTitle, metaDescription: props.metaDescription,
    imageAlt: props.imageAlt, hasImage: props.hasImage, focus: props.focus, siteHost: host,
  }), [props.title, props.slug, props.content, props.metaTitle, props.metaDescription, props.imageAlt, props.hasImage, props.focus, host]);

  const colour = result.level === "good" ? "#1f8a4c" : result.level === "warn" ? "#b7791f" : "#c0392b";
  const mark = (l: string) => (l === "good" ? "✓" : l === "warn" ? "!" : "✕");
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginTop: 18 }} aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: colour }}>{result.score}</div>
        <div>
          <strong>SEO score out of 100</strong>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {result.level === "good" ? "Good. This post is well set up." : result.level === "warn" ? "Getting there. Work through the notes below." : "Needs work. Start with the red items."}
            {" "}A higher score helps readers and search engines understand the post; it does not guarantee any ranking.
          </div>
        </div>
      </div>
      {dupes.length > 0 && (
        <p style={{ color: "#c0392b", fontSize: 13.5, marginTop: 10 }}>
          Another post already uses “{props.focus.trim()}” as its focus keyword: {dupes.map((d) => d.title).join(", ")}. Two posts aiming at the same words compete with each other. Choose a different focus keyword, or make this post cover a different angle.
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6, fontSize: 13.5 }}>
        {result.checks.map((c) => (
          <li key={c.id} style={{ display: "flex", gap: 8 }}>
            <span style={{ color: c.level === "good" ? "#1f8a4c" : c.level === "warn" ? "#b7791f" : "#c0392b", fontWeight: 700, width: 14 }} aria-hidden>{mark(c.level)}</span>
            <span><strong>{c.label}.</strong> {c.advice}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
