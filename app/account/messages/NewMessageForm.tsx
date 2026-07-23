"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findUserToMessage } from "@/actions/messages";

export function NewMessageForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; role: string }[]>([]);
  const [open, setOpen] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await findUserToMessage(value));
  }

  return (
    <div className="form-section" style={{ background: "var(--cream)", marginBottom: 20, position: "relative" }}>
      <label className="field-label" htmlFor="msg-search">New message — search by name or email</label>
      <input
        className="field"
        id="msg-search"
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Start typing a name..."
      />
      {open && results.length > 0 && (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="btn btn-ghost btn-small"
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 0" }}
              onClick={() => router.push(`/account/messages/${r.id}`)}
            >
              {r.name} <span className="age-pill" style={{ marginLeft: 6 }}>{r.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
