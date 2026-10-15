"use client";

import { useEffect, useState } from "react";
import { listMyPublishers, type AuthorPublisherRow } from "@/actions/submissions";

const NEW_PUBLISHER_VALUE = "__new__";

/**
 * Publisher picker for the eBook and print forms. Same behaviour as the
 * Author field: choose a publisher used before, or "+ Add Publisher" to
 * type a new one (which is remembered when the book is saved).
 */
export function PublisherField({
  value,
  onChange,
  id = "publisher",
}: {
  value: string;
  onChange: (name: string) => void;
  id?: string;
}) {
  const [publishers, setPublishers] = useState<AuthorPublisherRow[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    listMyPublishers().then(setPublishers);
  }, []);

  // A value that isn't in the saved list (a book's current publisher that was
  // typed before this dropdown existed) is still offered as an option.
  const options = [...publishers.map((p) => p.name)];
  if (value.trim() && !options.some((n) => n.toLowerCase() === value.trim().toLowerCase())) options.push(value.trim());

  const showInput = adding || options.length === 0;
  const selectValue = adding ? NEW_PUBLISHER_VALUE : value.trim() || NEW_PUBLISHER_VALUE;

  function handleSelect(v: string) {
    if (v === NEW_PUBLISHER_VALUE) {
      setAdding(true);
      onChange("");
    } else {
      setAdding(false);
      onChange(v);
    }
  }

  return (
    <div>
      <label className="field-label" htmlFor={id}>Publisher</label>
      {options.length > 0 && (
        <select className="field" id={id} value={selectValue} onChange={(e) => handleSelect(e.target.value)} style={{ marginBottom: showInput ? 10 : 0 }}>
          {options.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value={NEW_PUBLISHER_VALUE}>+ Add Publisher</option>
        </select>
      )}
      {showInput && (
        <input
          className="field"
          id={options.length === 0 ? id : `${id}-new`}
          type="text"
          placeholder="Publisher name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
