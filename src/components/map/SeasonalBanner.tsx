"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { currentNudge, nudgeKey, type Nudge } from "@/lib/seasonal";

// Seasonal prompt on the map. Dismissing it hides it until the next prompt.
export default function SeasonalBanner({ signedIn, className = "" }: { signedIn: boolean; className?: string }) {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  // Picked in the browser so the season matches the visitor's own date
  useEffect(() => {
    const n = currentNudge();
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(nudgeKey(n)) === "1";
    } catch {
      // storage blocked: just show it
    }
    if (!dismissed) setNudge(n);
  }, []);

  if (!nudge) return null;
  const target = `/react?category=${nudge.category}`;
  const href = signedIn ? target : `/signup?next=${encodeURIComponent(target)}`;

  return (
    <div className={`flex items-center gap-3 rounded-[18px] bg-surface py-2.5 pl-3 pr-2 shadow-control ${className}`}>
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-green-tint text-xl" aria-hidden>
          {nudge.emoji}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-bold">{nudge.title}</span>
          <span className="truncate text-[13px] text-green-deep">{nudge.question} →</span>
        </span>
      </Link>
      <button
        type="button"
        aria-label="Hide this"
        onClick={() => {
          try {
            localStorage.setItem(nudgeKey(nudge), "1");
          } catch {
            // storage blocked: hide for this visit only
          }
          setNudge(null);
        }}
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-field"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
