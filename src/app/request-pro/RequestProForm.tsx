"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { SITE } from "@/config/site";
import { createVendorRequestAction } from "./actions";

type Cat = { slug: string; name: string; icon: string };
const DETAILS_MAX = 300;
const chip = "flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[13px]";

// "Ask us to add a pro": for when you can't add them yourself (only a first name, no phone or Instagram).
export default function RequestProForm({ categories, initialName }: { categories: Cat[]; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState<string[]>([]);
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
          We&apos;ll look up {name.trim() || "them"} and add them to {SITE.name}. You can check on it anytime under Me, and if you&apos;ve turned on
          alerts, we&apos;ll buzz you when they&apos;re added.
        </p>
        <div className="mt-auto flex flex-col gap-2.5">
          <Link href="/profile" className="flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon">
            See my requests
          </Link>
          <Link href="/porch" className="flex h-[54px] items-center justify-center rounded-[16px] border border-line bg-surface text-[16px] font-semibold">
            Back to the Porch
          </Link>
        </div>
      </main>
    );
  }

  function submit() {
    if (name.trim().length < 2) return setError("Add the business or person's name.");
    if (!tags.length) return setError("Pick at least one thing they do.");
    setError(null);
    startTransition(async () => {
      const r = await createVendorRequestAction({ name, tags, details });
      if (r.ok) setSent(true);
      else setError(r.error);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/porch" aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Ask us to add a pro</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">
        Can&apos;t find them or don&apos;t have their number? Tell us what you know and we&apos;ll add them.
      </p>

      <label htmlFor="vr-name" className="mb-2 mt-6 text-[15px] font-semibold">
        Business or person&apos;s name
      </label>
      <input
        id="vr-name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jess at Glow Lash Studio"
        className="h-12 rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted"
      />

      <h2 className="mb-2 mt-6 text-[15px] font-semibold">
        What do they do? <span className="font-normal text-muted">pick all that apply</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const on = tags.includes(c.slug);
          return (
            <button
              key={c.slug}
              type="button"
              aria-pressed={on}
              onClick={() => setTags((t) => (on ? t.filter((x) => x !== c.slug) : [...t, c.slug].slice(0, 6)))}
              className={`${chip} ${on ? "bg-neon font-bold text-on-neon" : "border border-line bg-surface font-medium"}`}
            >
              <span aria-hidden>{c.icon}</span>
              {c.name}
            </button>
          );
        })}
      </div>

      <label htmlFor="vr-details" className="mb-2 mt-6 text-[15px] font-semibold">
        Anything that helps us find them <span className="font-normal text-muted">optional</span>
      </label>
      <textarea
        id="vr-details"
        value={details}
        maxLength={DETAILS_MAX}
        rows={3}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Phone, Instagram, website, or “the salon next to Publix on Main St”"
        className="resize-none rounded-[16px] border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-muted"
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
        {pending ? "One sec…" : "Send request"}
      </button>
    </main>
  );
}
