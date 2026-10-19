"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const PORCH_SEEN_KEY = "holler-porch-seen";

// Map button to The Porch, with a badge for new posts since your last visit.
export default function PorchButton({ signedIn }: { signedIn: boolean }) {
  const [count, setCount] = useState(0);

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
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {});
  }, [signedIn]);

  return (
    <Link
      href="/porch"
      aria-label={count ? `The Porch, ${count} new posts` : "The Porch"}
      className="relative flex size-12 flex-col items-center justify-center rounded-2xl bg-surface text-ink shadow-control"
    >
      <span className="text-lg leading-none" aria-hidden>
        🏡
      </span>
      <span className="mt-0.5 text-[10px] font-bold leading-none">Porch</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-love px-1 text-[11px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
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
