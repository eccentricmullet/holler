"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProLogo from "@/components/map/ProLogo";
import { track } from "@/components/Track";
import { HEADS_UP_TOPICS, KINDS, type PorchKind } from "@/lib/porch-kinds";
import type { SearchResult } from "@/app/api/pros/search/route";
import { createPostAction } from "../actions";

const MAX = 280;

// Shrinks a phone photo to at most 1600px wide/tall JPEG so posting stays fast.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/jpeg", 0.82));
}

export default function NewPost({ kinds, preset }: { kinds: PorchKind[]; preset: PorchKind | null }) {
  const router = useRouter();
  const [kind, setKind] = useState<PorchKind | null>(preset);
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA")); // YYYY-MM-DD, local
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pro, setPro] = useState<{ id: string; name: string } | null>(null);
  const [proQuery, setProQuery] = useState("");
  const [proResults, setProResults] = useState<Extract<SearchResult, { kind: "holler" }>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // "Just hired": find the pro on Holler to tag
  useEffect(() => {
    if (kind !== "just_hired" || pro || proQuery.trim().length < 2) return setProResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pros/search?q=${encodeURIComponent(proQuery)}&session=porch`, { signal: ctrl.signal });
        const data = await res.json();
        setProResults((data.results ?? []).filter((r: SearchResult) => r.kind === "holler"));
      } catch {
        // typing again cancels the previous search
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [proQuery, kind, pro]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  if (!kind) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <Link href="/porch" aria-label="Back to The Porch" className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <h1 className="mt-7 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">What&apos;s up?</h1>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className="flex flex-col items-start gap-2 rounded-[18px] border border-line bg-surface p-4 text-left"
            >
              <span className="text-3xl" aria-hidden>
                {KINDS[k].emoji}
              </span>
              <span className="text-base font-bold">{KINDS[k].label}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const info = KINDS[kind];

  function submit() {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("kind", kind!);
      form.set("body", body);
      if (topic) form.set("topic", topic);
      if (info.needsDate) form.set("happensOn", date);
      if (pro) form.set("proId", pro.id);
      if (photo) form.set("photo", new File([photo], "photo.jpg", { type: "image/jpeg" }));
      const r = await createPostAction(form);
      if (!r.ok) return setError(r.error);
      track("porch_posted", { kind: kind!, with_photo: !!photo });
      router.push(info.tab ? `/porch?tab=${info.tab}` : "/porch");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (preset ? router.back() : setKind(null))}
        className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <h1 className="mt-6 text-[30px] font-bold leading-[1.1] tracking-[-0.02em]">
        <span aria-hidden>{info.emoji}</span> {info.label}
      </h1>

      {kind === "heads_up" && (
        <div className="mt-5 grid grid-cols-4 gap-2" role="radiogroup" aria-label="What's it about?">
          {HEADS_UP_TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={topic === t.id}
              onClick={() => setTopic(t.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[13px] font-semibold ${
                topic === t.id ? "border-neon bg-neon text-on-neon" : "border-line"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {t.emoji}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {info.needsDate && (
        <label className="mt-5 flex items-center justify-between rounded-[18px] bg-field px-4 py-3 text-[15px] font-semibold">
          📅 When
          <input
            type="date"
            value={date}
            min={new Date().toLocaleDateString("en-CA")}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-base font-normal outline-none"
          />
        </label>
      )}

      <textarea
        rows={4}
        maxLength={MAX}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={info.prompt}
        aria-label="Your post"
        autoFocus
        className="mt-5 resize-none rounded-[16px] border border-line bg-surface px-4 py-3.5 text-base outline-none placeholder:text-muted"
      />
      <span className="mt-1 self-end text-[13px] text-muted">
        {body.length}/{MAX}
      </span>

      {kind === "just_hired" && (
        <div className="mt-3">
          {pro ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-green-tint p-2.5">
              <ProLogo name={pro.name} logoUrl={null} size={32} />
              <span className="flex-1 truncate text-[15px] font-semibold">{pro.name}</span>
              <button type="button" onClick={() => setPro(null)} className="text-sm font-semibold text-muted">
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={proQuery}
                onChange={(e) => setProQuery(e.target.value)}
                placeholder="Tag the pro (optional)"
                aria-label="Tag the pro"
                className="h-12 w-full rounded-xl bg-field px-4 text-base outline-none placeholder:text-muted"
              />
              {proResults.slice(0, 4).map((r) => (
                <button
                  key={r.proId}
                  type="button"
                  onClick={() => setPro({ id: r.proId, name: r.name })}
                  className="mt-1.5 flex w-full items-center gap-2.5 rounded-2xl p-2 text-left hover:bg-field"
                >
                  <ProLogo name={r.name} logoUrl={r.logoUrl} size={32} />
                  <span className="truncate text-[15px] font-semibold">{r.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const small = await shrink(f);
            setPhoto(small);
            setPreview(URL.createObjectURL(small));
          } catch {
            setError("Couldn't use that photo. Try another.");
          }
        }}
      />
      {preview ? (
        <div className="relative mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your photo" className="max-h-[240px] w-full rounded-2xl object-cover" />
          <button
            type="button"
            onClick={() => {
              setPhoto(null);
              setPreview(null);
            }}
            className="absolute right-2 top-2 rounded-xl bg-ink/70 px-2.5 py-1 text-sm font-semibold text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface text-[15px] font-semibold text-green-deep"
        >
          📷 Add a photo <span className="font-normal text-muted">optional</span>
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[15px] font-medium text-love">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending || !body.trim() || (kind === "heads_up" && !topic)}
        onClick={submit}
        className="mt-auto h-[54px] rounded-[16px] bg-neon pt-0 text-[17px] font-semibold text-on-neon disabled:opacity-40"
      >
        {pending ? "Posting…" : "Post to the porch"}
      </button>
      <p className="mt-2 text-center text-[13px] text-muted">
        Neighbors nearby see it. It comes down on its own{info.needsDate ? " after the date" : ` in ${info.days} days`}.
      </p>
    </main>
  );
}
