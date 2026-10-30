"use client";

import { useEffect } from "react";

/**
 * Gives every table cell a data-label (its column heading) so that on a phone or small
 * tablet the stylesheet can turn each row into a stacked card (heading on the left, value on
 * the right) instead of making the table scroll sideways. It runs once the page is shown and
 * again whenever a table's rows change (filters, pages, opened detail rows). It only adds an
 * attribute; it never changes what a table says.
 */
function headingText(th: HTMLElement): string {
  const clone = th.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button, svg, [role='tooltip'], .col-help, input").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

function labelTable(table: HTMLTableElement) {
  const headRow = table.tHead?.rows[0];
  if (!headRow) return;
  const headings: string[] = [];
  for (const th of Array.from(headRow.cells)) {
    const text = headingText(th);
    for (let i = 0; i < Math.max(1, th.colSpan); i++) headings.push(text);
  }
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const label = headings[col] ?? "";
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        col += Math.max(1, cell.colSpan);
      }
    }
  }
}

function labelAll(root: ParentNode) {
  root.querySelectorAll("table").forEach((t) => labelTable(t as HTMLTableElement));
}

export function TableLabels() {
  useEffect(() => {
    const root = document.querySelector("main") ?? document.body;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => labelAll(root));
    };
    labelAll(root);
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return null;
}
