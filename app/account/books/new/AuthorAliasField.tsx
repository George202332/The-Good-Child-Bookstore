"use client";

import { useEffect, useState } from "react";
import { capitalizeName } from "@/lib/person-name";
import { listMyAuthorAliases, type AuthorAliasRow } from "@/actions/submissions";

const NEW_AUTHOR_VALUE = "__new__";

/**
 * The author's First Name and Last Name, shown in Book Information right after the Book Title. Names
 * you have used before can be chosen from the list (they fill the two fields, which stay editable);
 * every name part is capitalised as you leave the field, so "anne-marie o'brien" becomes "Anne-Marie O'Brien".
 */
export function AuthorAliasField({
  firstName,
  lastName,
  onChange,
  idPrefix = "f",
}: {
  firstName: string;
  lastName: string;
  onChange: (firstName: string, lastName: string) => void;
  idPrefix?: string;
}) {
  const [aliases, setAliases] = useState<AuthorAliasRow[]>([]);
  const [selected, setSelected] = useState<string>(NEW_AUTHOR_VALUE);

  useEffect(() => {
    listMyAuthorAliases().then(setAliases);
  }, []);

  function handleSelect(value: string) {
    setSelected(value);
    if (value === NEW_AUTHOR_VALUE) {
      onChange("", "");
      return;
    }
    const alias = aliases.find((a) => a.id === value);
    if (alias) onChange(alias.firstName, alias.lastName);
  }

  return (
    <div>
      {aliases.length > 0 && (
        <select className="field" aria-label="Choose an author you have used before" value={selected} onChange={(e) => handleSelect(e.target.value)} style={{ marginBottom: 10 }}>
          {aliases.map((a) => (
            <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
          ))}
          <option value={NEW_AUTHOR_VALUE}>+ Add Author</option>
        </select>
      )}
      <div className="form-grid-2">
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-authfirst`}>First Name</label>
          <input className="field" id={`${idPrefix}-authfirst`} type="text" value={firstName} onChange={(e) => onChange(e.target.value, lastName)} onBlur={() => onChange(capitalizeName(firstName), lastName)} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${idPrefix}-authlast`}>Last Name</label>
          <input className="field" id={`${idPrefix}-authlast`} type="text" value={lastName} onChange={(e) => onChange(firstName, e.target.value)} onBlur={() => onChange(firstName, capitalizeName(lastName))} />
        </div>
      </div>
    </div>
  );
}
