"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SITE } from "@/config/site";
import { CATEGORY_KEYWORDS } from "@/lib/category-keywords";
import type { Category } from "./types";

// Bottom sheet with every category, grouped (Outside, Inside, …) with a search box.
export default function CategorySheet(props: {
  categories: Category[];
  current: string;
  onPick: (slug: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (c: Category) =>
      !needle || `${c.name} ${CATEGORY_KEYWORDS[c.slug] ?? ""}`.toLowerCase().includes(needle);
    const out: { section: string; items: Category[] }[] = [];
    for (const c of props.categories.filter(match)) {
      const section = c.section ?? "More";
      let g = out.find((x) => x.section === section);
      if (!g) out.push((g = { section, items: [] }));
      g.items.push(c);
    }
    return out;
  }, [props.categories, q]);

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/30 lg:items-center lg:justify-center" onClick={props.onClose}>
      <div
        role="dialog"
        aria-label="Pick a category"
        className="mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-[24px] bg-surface shadow-float lg:max-h-[80dvh] lg:rounded-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden />
          <h2 className="mb-3 px-1 text-xl font-bold">What do you need?</h2>
          <div className="flex h-12 items-center gap-2.5 rounded-xl bg-field px-4">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search, like gutters or dog walking"
              aria-label="Search categories"
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
          </div>
        </div>

        <div className="mt-3 overflow-y-auto px-5 pb-6">
          {groups.length === 0 && <p className="px-1 py-4 text-[15px] text-muted">No match. Try another word.</p>}
          {groups.map((g) => (
            <section key={g.section} className="mb-4">
              <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{g.section}</h3>
              <div className="grid grid-cols-3 gap-2.5">
                {g.items.map((c) => {
                  const on = c.slug === props.current;
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => props.onPick(c.slug)}
                      className={`flex flex-col items-center gap-1.5 rounded-[18px] border px-2 py-3 text-center text-[13px] font-semibold leading-tight ${
                        on ? "border-neon bg-green-wash" : "border-line bg-surface"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>
                        {c.icon}
                      </span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <Link href="/unlock" className="mt-1 block text-center text-sm font-semibold text-green-deep">
            Not in {SITE.launchTownShort}? Unlock your town →
          </Link>
        </div>
      </div>
    </div>
  );
}
