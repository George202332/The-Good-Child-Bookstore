"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CATS, PRICE_RANGES } from "@/lib/data/catalog";
import { parseShopFilters, filteredSortedBooks, SHOP_PAGE_SIZE } from "@/lib/shop-filters";
import { BookCard } from "@/components/BookCard";
import { ShopSidebar } from "@/components/ShopSidebar";

/** Converted from shopHTML() (the-good-child-bookstore_54_1.html:4049-4170). */
export function ShopPageClient({ eyebrow, heading, introText }: { eyebrow: string; heading: string; introText: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filters = parseShopFilters(searchParams);
  const list = filteredSortedBooks(filters);
  const totalPages = Math.max(1, Math.ceil(list.length / SHOP_PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const pageList = list.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE);

  const chips: { label: string; remove: () => void }[] = [];
  function paramsWithout(key: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === undefined) {
      params.delete(key);
    } else {
      const remaining = params.getAll(key).filter((v) => v !== value);
      params.delete(key);
      remaining.forEach((v) => params.append(key, v));
    }
    params.delete("page");
    return params;
  }
  function goTo(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (filters.search) chips.push({ label: `"${filters.search}"`, remove: () => goTo(paramsWithout("q")) });
  filters.cats.forEach((v) => {
    const c = CATS.find((x) => x.id === v);
    chips.push({ label: c ? c.name : v, remove: () => goTo(paramsWithout("cat", v)) });
  });
  filters.genres.forEach((v) => chips.push({ label: v, remove: () => goTo(paramsWithout("genre", v)) }));
  filters.ages.forEach((v) => chips.push({ label: `${v} yrs`, remove: () => goTo(paramsWithout("age", v)) }));
  filters.formats.forEach((v) => chips.push({ label: v, remove: () => goTo(paramsWithout("format", v)) }));
  filters.minRatings.forEach((v) => chips.push({ label: `${v}★ & up`, remove: () => goTo(paramsWithout("rating", v)) }));
  filters.priceRanges.forEach((id) => {
    const r = PRICE_RANGES.find((x) => x.id === id);
    chips.push({ label: r ? r.label : id, remove: () => goTo(paramsWithout("price", id)) });
  });

  function changePage(delta: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page + delta));
    goTo(params);
  }

  return (
    <div className="wrap" style={{ paddingTop: 48 }}>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 style={{ marginTop: 6 }}>{heading}</h1>
          <p style={{ color: "var(--ink-soft)", marginTop: 4 }}>{introText}</p>
        </div>
      </div>
      <div className="shop-searchbar">
        <button className="shop-filter-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open filters">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          Filters
          {chips.length > 0 && (
            <span
              style={{
                background: "var(--coral)",
                color: "#fff",
                borderRadius: "50%",
                width: 18,
                height: 18,
                fontSize: 11,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="active-filters" role="list" aria-label="Active filters">
          {chips.map((c, i) => (
            <div className="active-filter-chip" role="listitem" key={i}>
              {c.label}
              <button onClick={c.remove} aria-label={`Remove filter ${c.label}`}>×</button>
            </div>
          ))}
          {chips.length > 1 && (
            <button className="clear-filters" style={{ fontSize: 12.5 }} onClick={() => goTo(new URLSearchParams())}>
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="shop-layout">
        <ShopSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main role="main">
          {pageList.length > 0 ? (
            <div className="book-grid" aria-label="Book listings">
              {pageList.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No books match those filters yet</h3>
              <p>Try widening the age range or clearing a filter.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => goTo(new URLSearchParams())}>
                Clear filters
              </button>
            </div>
          )}
          {totalPages > 1 && (
            <div className="shop-pagination" role="navigation" aria-label="Page navigation">
              <button
                type="button"
                className="pagination-arrow"
                disabled={page <= 1}
                onClick={() => changePage(-1)}
                aria-label="Previous page"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="pagination-status">Page {page} of {totalPages}</span>
              <button
                type="button"
                className="pagination-arrow"
                disabled={page >= totalPages}
                onClick={() => changePage(1)}
                aria-label="Next page"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
