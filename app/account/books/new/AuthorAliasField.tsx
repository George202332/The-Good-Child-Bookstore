"use client";

import { useEffect, useState } from "react";
import { listMyAuthorAliases, type AuthorAliasRow } from "@/actions/submissions";

const NEW_AUTHOR_VALUE = "__new__";

export function AuthorAliasField({
  firstName,
  lastName,
  onChange,
}: {
  firstName: string;
  lastName: string;
  onChange: (firstName: string, lastName: string) => void;
}) {
  const [aliases, setAliases] = useState<AuthorAliasRow[]>([]);
  const [selected, setSelected] = useState<string>(NEW_AUTHOR_VALUE);
  const [showNewFields, setShowNewFields] = useState(true);

  useEffect(() => {
    listMyAuthorAliases().then(setAliases);
  }, []);

  function handleSelect(value: string) {
    setSelected(value);
    if (value === NEW_AUTHOR_VALUE) {
      setShowNewFields(true);
      onChange("", "");
    } else {
      const alias = aliases.find((a) => a.id === value);
      if (alias) {
        setShowNewFields(false);
        onChange(alias.firstName, alias.lastName);
      }
    }
  }

  return (
    <div>
      <label className="field-label">Author</label>
      <p className="field-hint" style={{ margin: "0 0 8px" }}>
        This is the name shown on the book&apos;s order page and detail page — a pen name is fine, and doesn&apos;t
        need to match your account name.
      </p>
      {aliases.length > 0 && (
        <select className="field" value={selected} onChange={(e) => handleSelect(e.target.value)} style={{ marginBottom: 10 }}>
          {aliases.map((a) => (
            <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
          ))}
          <option value={NEW_AUTHOR_VALUE}>+ Add Author</option>
        </select>
      )}
      {aliases.length === 0 && (
        <button type="button" className="btn btn-ghost btn-small" style={{ marginBottom: 10 }} onClick={() => setShowNewFields(true)}>
          + Add Author
        </button>
      )}
      {showNewFields && (
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-authfirst">First Name</label>
            <input className="field" id="f-authfirst" type="text" value={firstName} onChange={(e) => onChange(e.target.value, lastName)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-authlast">Last Name</label>
            <input className="field" id="f-authlast" type="text" value={lastName} onChange={(e) => onChange(firstName, e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
