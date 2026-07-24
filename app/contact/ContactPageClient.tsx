"use client";

import { useState } from "react";
import Link from "next/link";

/** Converted from contactHTML() (the-good-child-bookstore_54_1.html:6156-6208). */
export function ContactPageClient({ eyebrow, heading, introText }: { eyebrow: string; heading: string; introText: string }) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="wrap" style={{ padding: "56px 0 48px" }}>
      <div className="contact-card">
        <div className="contact-visual">
          <div className="contact-blob cb1" />
          <div className="contact-blob cb2" />
          <div className="contact-visual-inner">
            <span className="eyebrow" style={{ background: "rgba(255,255,255,0.14)", color: "var(--cream)" }}>{eyebrow}</span>
            <h2>{heading}</h2>
            <p>{introText}</p>
            <div className="contact-visual-rows">
              <div className="contact-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx={12} cy={10} r={2.5} />
                </svg>
                <p>14 Marigold Lane<br />Rivermill, ON</p>
              </div>
              <div className="contact-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" />
                </svg>
                <p>hello@thegoodchildbookstore.com</p>
              </div>
              <div className="contact-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx={12} cy={12} r={9} /><path d="M12 7v5l3 3" />
                </svg>
                <p>Mon–Fri, 9am–5pm ET<br />We reply within one business day</p>
              </div>
            </div>
            <div className="contact-quote">
              &ldquo;Order and shipping questions are usually fastest to solve from your{" "}
              <Link href="/cart" style={{ color: "var(--cream)", textDecoration: "underline" }}>cart and account</Link> page. For
              subscription changes, see our{" "}
              <Link href="/subscription" style={{ color: "var(--cream)", textDecoration: "underline" }}>subscription FAQ</Link>.&rdquo;
            </div>
          </div>
        </div>
        <form
          className="contact-form-panel"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            (e.target as HTMLFormElement).reset();
          }}
        >
          <h3>Send us a message</h3>
          <div className="form-row-2">
            <div className="field-group">
              <label htmlFor="c-name">Name</label>
              <input className="field-premium" id="c-name" type="text" placeholder="Your name" required />
            </div>
            <div className="field-group">
              <label htmlFor="c-email">Email</label>
              <input className="field-premium" id="c-email" type="email" placeholder="you@example.com" required />
            </div>
          </div>
          <div className="field-group">
            <label htmlFor="c-topic">What&apos;s this about?</label>
            <select className="field-premium" id="c-topic">
              <option>An order</option>
              <option>A subscription</option>
              <option>A book recommendation</option>
              <option>Something else</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="c-message">Message</label>
            <textarea className="field-premium" id="c-message" placeholder="Tell us a little about what you need" required />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            Send message
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
          {submitted ? (
            <p className="contact-form-note" style={{ color: "#1F6B48" }}>Thanks — we&apos;ll write back within a day.</p>
          ) : (
            <p className="contact-form-note">We typically reply within one business day.</p>
          )}
        </form>
      </div>
    </div>
  );
}
