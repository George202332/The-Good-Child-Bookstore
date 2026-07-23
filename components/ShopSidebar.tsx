"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CATS, GENRES, AGE_RANGES, PRICE_RANGES, BOOKS } from "@/lib/data/catalog";

/**
 * Converted from the `.shop-sidebar` filter-block markup in shopHTML()
 * (the-good-child-bookstore_54_1.html:4090-4149). Checkbox state is driven
 * by the URL's own search params (see lib/shop-filters.ts) instead of a
 * mutable module-level `filters` object, so toggling a checkbox here
 * navigates to an updated URL rather than mutating shared state.
 */
export function ShopSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formats = Array.from(new Set(BOOKS.map((b) => b.format)));

  function toggle(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.getAll(key);
    params.delete(key);
    if (current.includes(value)) {
      current.filter((v) => v !== value).forEach((v) => params.append(key, v));
    } else {
      [...current, value].forEach((v) => params.append(key, v));
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function has(key: string, value: string) {
    return searchParams.getAll(key).includes(value);
  }

  function clearAll() {
    router.push(pathname, { scroll: false });
    onClose();
  }

  return (
    <>
      <div
        id="shop-sidebar-overlay"
        className="shop-sidebar-overlay"
        style={{ display: open ? "block" : "none" }}
        onClick={onClose}
      />
      <aside className={`shop-sidebar ${open ? "open" : ""}`} id="shop-sidebar" role="complementary" aria-label="Book filters">
        <button className="shop-sidebar-close" onClick={onClose} aria-label="Close filters">
          <span>Filters</span>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="filter-block">
          <h4>Category</h4>
          {CATS.map((c) => (
            <label key={c.id} className="filter-option">
              <input type="checkbox" checked={has("cat", c.id)} onChange={() => toggle("cat", c.id)} />
              {c.name}
            </label>
          ))}
        </div>
        <div className="filter-block">
          <h4>Genre</h4>
          {GENRES.map((g) => (
            <label key={g} className="filter-option">
              <input type="checkbox" checked={has("genre", g)} onChange={() => toggle("genre", g)} />
              {g}
            </label>
          ))}
        </div>
        <div className="filter-block">
          <h4>Age range</h4>
          {AGE_RANGES.map((a) => (
            <label key={a} className="filter-option">
              <input type="checkbox" checked={has("age", a)} onChange={() => toggle("age", a)} />
              {a} years
            </label>
          ))}
        </div>
        <div className="filter-block">
          <h4>Price</h4>
          {PRICE_RANGES.map((r) => (
            <label key={r.id} className="filter-option">
              <input type="checkbox" checked={has("price", r.id)} onChange={() => toggle("price", r.id)} />
              {r.label}
            </label>
          ))}
        </div>
        <div className="filter-block">
          <h4>Format</h4>
          {formats.map((f) => (
            <label key={f} className="filter-option">
              <input type="checkbox" checked={has("format", f)} onChange={() => toggle("format", f)} />
              {f}
            </label>
          ))}
        </div>
        <div className="filter-block">
          <h4>Reviews</h4>
          {[5, 4, 3].map((r) => (
            <label key={r} className="filter-option filter-option-rating">
              <input type="checkbox" checked={has("rating", String(r))} onChange={() => toggle("rating", String(r))} />
              <span className="filter-stars">
                <span className="stars-bg">★★★★★</span>
                <span className="stars-fg" style={{ width: `${(r / 5) * 100}%` }}>★★★★★</span>
              </span>
              <span className="filter-stars-label">&amp; up</span>
            </label>
          ))}
        </div>
        <button className="clear-filters" onClick={clearAll}>Clear all filters</button>
      </aside>
    </>
  );
}
