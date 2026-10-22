"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { aCategoryPro } from "@/lib/words";
import { createAskAction } from "../actions";

// One tap: "Need a plumber? Ask neighbors." Nearby neighbors answer with a pro.
export default function NewAsk({ category }: { category: { slug: string; name: string; icon: string } }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const phrase = aCategoryPro(category.name);

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <span className="mt-20 size-20 rounded-[18px] bg-green-tint text-center text-[42px] leading-[80px]" aria-hidden>
          📣
        </span>
        <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Asked!</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">
          Nearby neighbors will see that you need {phrase}. Their picks show up on your Asks page.
        </p>
        <div className="mt-auto flex flex-col gap-2.5">
          <Link href="/asks" className="flex h-[54px] items-center justify-center rounded-[18px] bg-neon text-[17px] font-semibold text-on-neon">
            See your asks
          </Link>
          <Link href="/" className="flex h-[54px] items-center justify-center rounded-[18px] bg-field text-[17px] font-semibold text-ink">
            Back to the map
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/" aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <span className="mt-10 size-20 rounded-[18px] bg-green-tint text-center text-[42px] leading-[80px]" aria-hidden>
        {category.icon}
      </span>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Need {phrase}?</h1>
      <p className="mt-2.5 text-base leading-snug text-muted">
        We&apos;ll ask nearby neighbors who they use. They answer by picking a pro, so no long threads. Only your first name and
        last initial show.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-[15px] font-medium text-love">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await createAskAction(category.slug);
            if (r.ok) setSent(true);
            else setError(r.error);
          })
        }
        className="mt-auto h-[54px] rounded-[16px] bg-neon text-[17px] font-semibold text-on-neon disabled:opacity-60"
      >
        {pending ? "One sec…" : "Ask my neighbors"}
      </button>
    </main>
  );
}
