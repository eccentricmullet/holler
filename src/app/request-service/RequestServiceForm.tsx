"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SITE } from "@/config/site";
import { createCategoryRequestAction } from "./actions";

const NAME_MAX = 40;
const DETAILS_MAX = 200;
const field = "rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted";

// "Suggest a service": for when the kind of pro you need isn't in the list yet.
export default function RequestServiceForm({ initialName, backHref }: { initialName: string; backHref: string }) {
  const [name, setName] = useState(initialName);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <span className="mt-16 text-[52px]" aria-hidden>
          📬
        </span>
        <h1 className="mt-4 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Sent!</h1>
        <p className="mt-2 text-[15px] leading-snug text-muted">
          We&apos;ll look at adding &ldquo;{name.trim()}&rdquo; to {SITE.name}. You can check on it anytime under Me, and if you&apos;ve turned on alerts,
          we&apos;ll buzz you when it&apos;s added.
        </p>
        <div className="mt-auto flex flex-col gap-2.5">
          <Link href={backHref} className="flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon">
            Done
          </Link>
          <Link href="/profile" className="flex h-[54px] items-center justify-center rounded-[16px] border border-line bg-surface text-[16px] font-semibold">
            See my requests
          </Link>
        </div>
      </main>
    );
  }

  function submit() {
    if (name.trim().length < 2) return setError("Type the service you're looking for.");
    setError(null);
    startTransition(async () => {
      const r = await createCategoryRequestAction({ name, details });
      if (r.ok) setSent(true);
      else setError(r.error);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href={backHref} aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Suggest a service</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">Don&apos;t see the kind of pro you need? Tell us and we&apos;ll add it for everyone.</p>

      <label htmlFor="cr-name" className="mb-2 mt-6 text-[15px] font-semibold">
        What service?
      </label>
      <input
        id="cr-name"
        value={name}
        maxLength={NAME_MAX}
        autoFocus={!initialName}
        onChange={(e) => setName(e.target.value)}
        placeholder="Babysitting, tutoring, piano lessons…"
        className={`h-12 ${field}`}
      />

      <label htmlFor="cr-details" className="mb-2 mt-6 text-[15px] font-semibold">
        Anything else? <span className="font-normal text-muted">optional</span>
      </label>
      <textarea
        id="cr-details"
        value={details}
        maxLength={DETAILS_MAX}
        rows={3}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="What you'd use them for"
        className={`resize-none py-3 ${field}`}
      />
      <span className="mt-1 text-xs text-muted">Only the {SITE.name} team sees this.</span>

      {error && (
        <p role="alert" className="mt-3 text-[15px] font-medium text-love">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-8 h-[54px] shrink-0 rounded-[16px] bg-neon text-[16px] font-bold text-on-neon disabled:opacity-60"
      >
        {pending ? "One sec…" : "Send"}
      </button>
    </main>
  );
}
