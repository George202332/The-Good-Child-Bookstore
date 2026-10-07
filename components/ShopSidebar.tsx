"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CATS, AGE_RANGES, PRICE_RANGES, BOOKS } from "@/lib/data/catalog";
import { CATEGORIES, categorySlug, subcategoriesFor } from "@/lib/taxonomy";

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
  const [openCat, setOpenCat] = useState<string | null>(null);
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

  // Subcategory is `?sub=`; the retired thematic `?genre=` tag is read as a
  // subcategory too, so old shared links still show their box ticked and
  // untick cleanly.
  function hasSub(value: string) {
    return has("sub", value) || has("genre", value);
  }

  function pushParams(params: URLSearchParams) {
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Clicking a Category applies it (adds ?series=) and opens its pop-up.
  function selectSeries(slug: string) {
    if (has("series", slug)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.append("series", slug);
    pushParams(params);
  }

  // Ticking a subcategory also makes sure its Category is selected.
  function toggleSubIn(slug: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const active = hasSub(value);
    const subs = [...params.getAll("sub"), ...params.getAll("genre")].filter((v) => v !== value);
    params.delete("sub");
    params.delete("genre");
    (active ? subs : [...subs, value]).forEach((v) => params.append("sub", v));
    if (!active && !params.getAll("series").includes(slug)) params.append("series", slug);
    pushParams(params);
  }

  // "Clear" removes the Category's subcategories and the Category itself.
  function clearSeries(slug: string, subs: readonly string[]) {
    const params = new URLSearchParams(searchParams.toString());
    const others = params.getAll("series").filter((v) => v !== slug);
    const keep = [...params.getAll("sub"), ...params.getAll("genre")].filter((v) => !subs.includes(v));
    params.delete("series");
    params.delete("sub");
    params.delete("genre");
    others.forEach((v) => params.append("series", v));
    keep.forEach((v) => params.append("sub", v));
    pushParams(params);
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
          {CATEGORIES.map((cat) => {
            const slug = categorySlug(cat);
            const subs = subcategoriesFor(cat);
            const count = subs.filter(hasSub).length;
            return (
              <CategoryRow
                key={cat}
                cat={cat}
                subs={subs}
                selected={has("series", slug)}
                count={count}
                open={openCat === cat}
                onOpen={() => {
                  selectSeries(slug);
                  setOpenCat(cat);
                }}
                onClose={() => setOpenCat((c) => (c === cat ? null : c))}
                isChecked={hasSub}
                onToggleSub={(sub) => toggleSubIn(slug, sub)}
                onClear={() => clearSeries(slug, subs)}
              />
            );
          })}
        </div>
        <div className="filter-block">
          <h4>Genre</h4>
          {CATS.map((c) => (
            <label key={c.id} className="filter-option">
              <input type="checkbox" checked={has("cat", c.id)} onChange={() => toggle("cat", c.id)} />
              {c.name}
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

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia("(max-width: 860px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getNarrow() {
  return window.matchMedia("(max-width: 860px)").matches;
}

type CategoryRowProps = {
  cat: string;
  subs: readonly string[];
  selected: boolean;
  count: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  isChecked: (sub: string) => boolean;
  onToggleSub: (sub: string) => void;
  onClear: () => void;
};

/**
 * A Category row plus its floating subcategory pop-up. The pop-up is portalled
 * to <body> (the mobile sidebar drawer is transformed, which would otherwise
 * trap position:fixed). Desktop: anchored to the right of the row. Narrow
 * screens: centred modal with a backdrop.
 */
function CategoryRow({ cat, subs, selected, count, open, onOpen, onClose, isChecked, onToggleSub, onClear }: CategoryRowProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [atEnd, setAtEnd] = useState(false);

  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, () => false);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const panelH = panelRef.current?.offsetHeight ?? 340;
    const maxTop = Math.max(8, window.innerHeight - panelH - 8);
    setPos({ left: r.right + 10, top: Math.min(Math.max(8, r.top - 8), maxTop) });
  }, []);

  useLayoutEffect(() => {
    if (!open || narrow) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, narrow, place]);

  const close = useCallback(() => {
    onClose();
    btnRef.current?.focus();
  }, [onClose]);

  // Focus the first checkbox on open; close on outside press / Escape.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>("input, button"),
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, close]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  }

  const panel = (
    <div
      ref={panelRef}
      className={`subcat-popover ${narrow ? "subcat-popover-modal" : ""}`}
      role="dialog"
      aria-label={`${cat} subcategories`}
      aria-modal={narrow ? true : undefined}
      style={narrow || !pos ? undefined : { left: pos.left, top: pos.top }}
    >
      <div className="subcat-popover-head">
        <span id={titleId} className="subcat-popover-title">{cat}</span>
      </div>
      <div className={`subcat-popover-scroll ${atEnd ? "at-end" : ""}`}>
        <div className="subcat-popover-list" onScroll={onScroll} role="group" aria-labelledby={titleId} tabIndex={-1}>
          {subs.map((sub) => (
            <label key={sub} className="filter-option">
              <input type="checkbox" checked={isChecked(sub)} onChange={() => onToggleSub(sub)} />
              {sub}
            </label>
          ))}
        </div>
      </div>
      <div className="subcat-popover-foot">
        <button type="button" className="clear-filters" onClick={onClear}>Clear</button>
        <button type="button" className="subcat-done" onClick={close}>Done</button>
      </div>
    </div>
  );

  return (
    <div>
      <button
        type="button"
        ref={btnRef}
        className={`filter-option subcat-trigger ${selected ? "is-selected" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : onOpen())}
      >
        <span className="subcat-trigger-name">{cat}</span>
        {count > 0 && (
          <span className="subcat-badge" aria-label={`${count} subcategories selected`}>{count}</span>
        )}
        <svg className="subcat-chevron" viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          narrow ? <div className="subcat-backdrop">{panel}</div> : panel,
          document.body,
        )}
    </div>
  );
}
