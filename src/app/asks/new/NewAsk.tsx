"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIMINGS, type Timing } from "@/lib/ask-timing";
import { createAskAction } from "../actions";

const NOTE_MAX = 120;
type Cat = { slug: string; name: string; icon: string };

const chip = "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px]";
const on = "bg-neon font-bold text-on-neon";
const off = "border border-line bg-surface font-medium text-ink";

// Pro request: who you need (required), when, and a short note. Neighbors within 20 miles answer with a pro.
export default function NewAsk({ categories, preset }: { categories: Cat[]; preset: string | null }) {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(preset);
  const [timing, setTiming] = useState<Timing>("this_week");
  const [neededOn, setNeededOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  // Picked one first, then the rest
  const ordered = preset ? [...categories].sort((a, b) => Number(b.slug === preset) - Number(a.slug === preset)) : categories;

  function submit() {
    if (!category) return setError("Pick who you need.");
    if (timing === "date" && !neededOn) return setError("Pick the date you need them.");
    setError(null);
    startTransition(async () => {
      const r = await createAskAction({ category, timing, neededOn: timing === "date" ? neededOn : null, note });
      if (!r.ok) return setError(r.error);
      router.push("/porch?tab=pros");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/porch" aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Who do you need?</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">
        Neighbors within 20 miles answer with pros they actually use. Only your first name and last initial show.
      </p>

      <h2 className="mb-2 mt-6 text-[15px] font-semibold">Service</h2>
      <div className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6" role="radiogroup" aria-label="Service">
        {ordered.map((c) => (
          <button
            key={c.slug}
            type="button"
            role="radio"
            aria-checked={category === c.slug}
            onClick={() => setCategory(c.slug)}
            className={`${chip} ${category === c.slug ? on : off}`}
          >
            <span aria-hidden>{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-semibold">When?</h2>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="When">
        {TIMINGS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={timing === t.id} onClick={() => setTiming(t.id)} className={`${chip} ${timing === t.id ? on : off}`}>
            {t.label}
          </button>
        ))}
      </div>
      {timing === "date" && (
        <input
          type="date"
          min={today}
          value={neededOn}
          onChange={(e) => setNeededOn(e.target.value)}
          aria-label="Date you need them"
          className="mt-3 h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none"
        />
      )}

      <label htmlFor="ask-note" className="mb-2 mt-6 text-[15px] font-semibold">
        Add a note <span className="font-normal text-muted">optional</span>
      </label>
      <textarea
        id="ask-note"
        value={note}
        maxLength={NOTE_MAX}
        rows={3}
        onChange={(e) => setNote(e.target.value)}
        placeholder="2 bed / 2 bath. Who do you trust with a key?"
        className="resize-none rounded-[16px] border border-line bg-surface px-4 py-3 text-base outline-none placeholder:text-muted"
      />
      <span className="mt-1 self-end text-xs text-muted">
        {note.length}/{NOTE_MAX}
      </span>

      {error && (
        <p role="alert" className="mt-3 text-[15px] font-medium text-love">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-auto h-[54px] shrink-0 rounded-[16px] bg-neon text-[16px] font-bold text-on-neon disabled:opacity-60"
      >
        {pending ? "One sec…" : "Ask my neighbors"}
      </button>
    </main>
  );
}
