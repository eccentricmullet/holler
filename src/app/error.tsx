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
      <span className="mt-20 size-20 rounded-[28px] bg-love-tint text-center text-[42px] leading-[80px]" aria-hidden>
        😬
      </span>
      <h1 className="mt-6 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">Something went sideways</h1>
      <p className="mt-2.5 text-base leading-snug text-muted">That&apos;s on us, not you. Try again, and if it keeps happening, check back in a few minutes.</p>
      <div className="mt-auto flex flex-col gap-2.5">
        <button type="button" onClick={reset} className="h-[58px] rounded-[20px] bg-green-deep text-[17px] font-semibold text-white">
          Try again
        </button>
        <Link href="/" className="flex h-[58px] items-center justify-center rounded-[20px] bg-field text-[17px] font-semibold text-ink">
          Back to the map
        </Link>
      </div>
    </main>
  );
}
