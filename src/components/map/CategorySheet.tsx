"use client";

import Link from "next/link";
import { SITE } from "@/config/site";
import type { Category } from "./types";

// Bottom sheet with the 12 categories.
export default function CategorySheet(props: {
  categories: Category[];
  current: string;
  onPick: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-ink/30" onClick={props.onClose}>
      <div
        role="dialog"
        aria-label="Pick a category"
        className="mx-auto w-full max-w-md rounded-t-[32px] bg-surface px-5 pb-8 pt-3 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <h2 className="mb-4 px-1 text-xl font-bold">What do you need?</h2>
        <div className="grid grid-cols-3 gap-3">
          {props.categories.map((c) => {
            const on = c.slug === props.current;
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={on}
                onClick={() => props.onPick(c.slug)}
                className={`flex flex-col items-center gap-1.5 rounded-[20px] border-[2.5px] px-2 py-3 text-[13px] font-semibold ${
                  on ? "border-green bg-green-wash" : "border-line bg-surface"
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
        <Link href="/unlock" className="mt-5 block text-center text-sm font-semibold text-green-deep">
          Not in {SITE.launchTownShort}? Unlock your town →
        </Link>
      </div>
    </div>
  );
}
