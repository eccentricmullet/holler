"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const PORCH_SEEN_KEY = "holler-porch-seen";

type Peek = { emoji: string; label: string; text: string } | null;

// Wide map button to The Porch: a count of new posts since your last visit and a peek at the newest.
export default function PorchButton({ signedIn, className = "" }: { signedIn: boolean; className?: string }) {
  const [count, setCount] = useState(0);
  const [peek, setPeek] = useState<Peek>(null);

  useEffect(() => {
    if (!signedIn) return;
    let since = "";
    try {
      since = localStorage.getItem(PORCH_SEEN_KEY) ?? "";
    } catch {
      // storage blocked: count the last few days
    }
    fetch(`/api/porch/summary${since ? `?since=${encodeURIComponent(since)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setCount(d.count ?? 0);
        setPeek(d.peek ?? null);
      })
      .catch(() => {});
  }, [signedIn]);

  return (
    <Link
      href="/porch"
      aria-label={count ? `The Porch, ${count} new posts` : "The Porch"}
      className={`relative flex items-center gap-3 rounded-[22px] bg-green-deep py-2.5 pl-2.5 pr-4 text-white shadow-[0_8px_20px_rgba(23,138,53,0.35)] ${className}`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[24px]" aria-hidden>
        🏡
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-[17px] font-bold leading-tight">
          The Porch
          {count > 0 && (
            <span className="rounded-full bg-lime px-2 py-0.5 text-[12px] font-bold leading-none text-ink">
              {count > 9 ? "9+" : count} new
            </span>
          )}
        </span>
        <span className="truncate text-[13px] text-white/85">
          {peek ? `${peek.emoji} ${peek.label}: ${peek.text}` : "Curb alerts, garage sales, lost pets & more"}
        </span>
      </span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

// Called when the Porch page is opened, so the badge resets
export function SeenPorch() {
  useEffect(() => {
    try {
      localStorage.setItem(PORCH_SEEN_KEY, new Date().toISOString());
    } catch {
      // storage blocked: badge just won't reset
    }
  }, []);
  return null;
}
