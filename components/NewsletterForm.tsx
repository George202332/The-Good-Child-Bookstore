"use client";

import { useState } from "react";

/**
 * Converted from the newsletter form in homeHTML()
 * (the-good-child-bookstore_54_1.html:3953-3963). The original never
 * persisted the signup anywhere either — it just showed a toast and reset
 * the form — so this is faithful, not a stub: there's genuinely no real
 * email list to join yet. Shows inline confirmation text instead of a
 * toast since no global toast system exists in this build.
 */
export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="newsletter">
      <div>
        <h2>One good book, every month.</h2>
        <p>Join the shelf list for new arrivals, staff picks, and the occasional bedtime-reading tip.</p>
      </div>
      {submitted ? (
        <p style={{ color: "var(--cream)", fontWeight: 700 }}>You&apos;re on the list!</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <input type="text" placeholder="Your name" required aria-label="Your name" />
          <input type="email" placeholder="you@example.com" required aria-label="Your email" />
          <button className="btn btn-primary" type="submit">Join the list</button>
        </form>
      )}
    </div>
  );
}
