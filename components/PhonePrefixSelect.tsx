"use client";

import { dialCodeOptions } from "@/lib/phone-prefix";

/**
 * The phone number prefix selector: shows only the code (for example +1 or +254), with no country initials.
 * The page owns the value; see lib/phone-prefix.ts for the rules (it follows the country until the customer picks
 * one by hand).
 */
export function PhonePrefixSelect({
  value,
  onChange,
  id,
  className = "field field-compact",
  style,
}: {
  value: string;
  onChange: (prefix: string) => void;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const options = dialCodeOptions();
  // A saved prefix that is not in the list (should not happen) is still shown rather than silently changed.
  const all = options.includes(value) || !value ? options : [value, ...options];
  return (
    <select
      id={id}
      className={className}
      style={{ maxWidth: 96, flexShrink: 0, ...style }}
      aria-label="Phone country code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {all.map((code) => <option key={code} value={code}>{code}</option>)}
    </select>
  );
}
