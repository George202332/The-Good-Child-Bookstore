"use client";

/**
 * Each edition has its own Affiliate Eligible switch. When a second edition is being published, this offers
 * to copy the first edition's setting. It is only an offer: the author can change the switch afterwards, and
 * nothing is ever copied by itself.
 */
export function AffiliateCopyOffer({ from, value, current, onCopy }: {
  /** The edition the setting would come from, e.g. "eBook" or "Print". */
  from: string;
  value: boolean | undefined;
  current: boolean;
  onCopy: (value: boolean) => void;
}) {
  if (value === undefined || value === current) return null;
  return (
    <p className="field-hint" style={{ margin: "6px 0 0" }}>
      Your {from} edition has Affiliate Eligible turned {value ? "on" : "off"}.{" "}
      <button type="button" className="btn btn-ghost btn-small" onClick={() => onCopy(value)}>Copy that setting here</button>{" "}
      You can still change it afterwards.
    </p>
  );
}
