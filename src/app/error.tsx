"use client";

import { useEffect } from "react";
import Link from "next/link";

// Shown if something breaks while loading a screen.
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <span className="mt-20 size-20 rounded-[18px] bg-love-tint text-center text-[42px] leading-[80px]" aria-hidden>
        😬
      </span>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Something went sideways</h1>
      <p className="mt-2.5 text-base leading-snug text-muted">That&apos;s on us, not you. Try again, and if it keeps happening, check back in a few minutes.</p>
      <div className="mt-auto flex flex-col gap-2.5">
        <button type="button" onClick={reset} className="h-[54px] rounded-[16px] bg-neon text-[17px] font-semibold text-on-neon">
          Try again
        </button>
        <Link href="/" className="flex h-[54px] items-center justify-center rounded-[18px] bg-field text-[17px] font-semibold text-ink">
          Back to the map
        </Link>
      </div>
    </main>
  );
}
