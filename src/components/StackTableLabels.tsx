import { useEffect } from "react";

/** Copies each column name onto its cells so the phone card layout can show it above the value. */
export function StackTableLabels() {
  useEffect(() => {
    const label = () => {
      document.querySelectorAll<HTMLTableElement>("table.stack-table").forEach((tbl) => {
        const heads = Array.from(tbl.querySelectorAll("thead th")).map((h) => (h.textContent || "").trim());
        if (!heads.length) return;
        tbl.querySelectorAll("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, i) => {
            const el = cell as HTMLElement;
            const name = el.hasAttribute("colspan") ? "" : heads[i] || "";
            if (el.getAttribute("data-label") !== name) el.setAttribute("data-label", name);
          });
        });
      });
    };
    label();
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(label, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
