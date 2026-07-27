"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findUserToMessage } from "@/actions/messages";

function initialsFor(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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
    <div className="map-card" style={{ padding: 20, background: "var(--cream)", marginBottom: 20, position: "relative" }}>
      <label className="field-label" htmlFor="msg-search">New message: search by name or email</label>
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
        <div className="inbox-list" style={{ marginTop: 4 }}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="inbox-row"
              style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => router.push(`/account/messages/${r.id}`)}
            >
              <div className="inbox-avatar">{initialsFor(r.name)}</div>
              <div className="inbox-row-body">
                <div className="inbox-name">{r.name}</div>
              </div>
              <span className="age-pill">{r.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
