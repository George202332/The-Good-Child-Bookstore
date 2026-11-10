"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A neat progress strip along the top of a publishing form: one chip per numbered section, so the author sees where they are and
 * can jump straight to any section. The chips are read from the form's own sections (so a new section appears here by itself),
 * and the chip of the section being worked on lights up as the page scrolls. It changes nothing in the form.
 */
interface Step { id: string; n: string; title: string }

export function StepStrip() {
  const anchor = useRef<HTMLDivElement>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    const host = anchor.current?.parentElement;
    if (!host) return;
    const find = () => {
      const found: Step[] = [];
      host.querySelectorAll<HTMLElement>(".form-section[id]").forEach((sec) => {
        const title = sec.querySelector("h3")?.textContent?.trim();
        const n = sec.querySelector("h3")?.parentElement?.previousElementSibling?.textContent?.trim() ?? "";
        if (title && sec.offsetParent !== null) found.push({ id: sec.id, n, title });
      });
      setSteps((old) => (JSON.stringify(old) === JSON.stringify(found) ? old : found));
    };
    find();
    const mo = new MutationObserver(find);
    mo.observe(host, { childList: true, subtree: true });
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setCurrent(hit.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    host.querySelectorAll(".form-section[id]").forEach((s) => io.observe(s));
    return () => { mo.disconnect(); io.disconnect(); };
  }, []);

  return (
    <div ref={anchor}>
      {steps.length > 1 && (
        <nav className="step-strip" aria-label="Sections of this form">
          {steps.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`step-chip${current === s.id ? " is-current" : ""}`}
              aria-current={current === s.id ? "step" : undefined}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <span className="step-chip-n">{s.n}</span>
              <span className="step-chip-t">{s.title}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
