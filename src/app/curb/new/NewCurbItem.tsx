"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/components/Track";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { CURB_DAYS, CURB_KINDS, CURB_MAX_PHOTOS, CURB_NOTE_MAX, CURB_TITLE_MAX, type CurbKind } from "@/lib/curb-kinds";
import { createCurbItemAction } from "../actions";

const chip = "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px]";
const on = "bg-neon font-bold text-on-neon";
const off = "border border-line bg-surface font-medium";
const field = "rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted";

// List on the Curb: photos, title, price or Free, what kind of thing, a short note.
export default function NewCurbItem() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([]);
  const [title, setTitle] = useState("");
  const [free, setFree] = useState(false);
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<CurbKind | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Free the photo previews when leaving
  const urls = useRef<string[]>([]);
  urls.current = photos.map((p) => p.url);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function addPhotos(files: FileList | null) {
    const room = CURB_MAX_PHOTOS - photos.length;
    const picked = Array.from(files ?? []).slice(0, room);
    try {
      const small = await Promise.all(picked.map(shrinkPhoto));
      setPhotos((p) => [...p, ...small.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))].slice(0, CURB_MAX_PHOTOS));
      setError(null);
    } catch {
      setError("Couldn't use that photo. Try another.");
    }
  }

  function submit() {
    if (!photos.length) return setError("Add at least one photo.");
    if (title.trim().length < 2) return setError("Add a title, like “Kids bike” or “Couch”.");
    const dollars = free ? 0 : Math.round(Number(price.replace(/[$,\s]/g, "")));
    if (!free && (!price.trim() || !Number.isFinite(dollars) || dollars <= 0)) return setError("Add a price, or switch on Free.");
    if (!kind) return setError("Pick what kind of thing it is.");
    setError(null);
    const form = new FormData();
    form.set("title", title);
    form.set("note", note);
    form.set("price", String(dollars));
    form.set("kind", kind);
    photos.forEach((p, i) => form.append("photos", new File([p.blob], `photo-${i}.jpg`, { type: "image/jpeg" })));
    startTransition(async () => {
      const r = await createCurbItemAction(form);
      if (!r.ok) return setError(r.error);
      track("curb_listed", { free, photos: photos.length, kind });
      router.replace(`/curb/${r.id}`);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/curb" aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className="mt-5 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">List on the Curb</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">Neighbors within 20 miles see it for {CURB_DAYS} days. Free things get a 📣 Curb alert.</p>

      <h2 className="mb-2 mt-5 text-[15px] font-semibold">
        Photos <span className="font-normal text-muted">up to {CURB_MAX_PHOTOS}, the first one shows on the Curb</span>
      </h2>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p, i) => (
          <div key={p.url} className="relative aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Photo ${i + 1}`} className="size-full rounded-[12px] object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => {
                URL.revokeObjectURL(p.url);
                setPhotos((all) => all.filter((x) => x !== p));
              }}
              className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-ink text-surface shadow-card"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
        {photos.length < CURB_MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Add photos"
            className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[12px] border border-dashed border-line bg-surface text-green-deep"
          >
            <span className="text-xl" aria-hidden>
              📷
            </span>
            <span className="text-[12px] font-semibold">Add</span>
          </button>
        )}
      </div>

      <label htmlFor="curb-title" className="mb-2 mt-5 text-[15px] font-semibold">
        Title
      </label>
      <input
        id="curb-title"
        value={title}
        maxLength={CURB_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Patio chairs, set of 4"
        className={`h-12 ${field}`}
      />

      <h2 className="mb-2 mt-5 text-[15px] font-semibold">Price</h2>
      <div className="flex gap-2">
        <label className={`flex h-12 flex-1 items-center gap-1 ${field} ${free ? "opacity-50" : ""}`}>
          <span className="text-muted" aria-hidden>
            $
          </span>
          <input
            value={free ? "" : price}
            disabled={free}
            inputMode="numeric"
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            placeholder={free ? "Free" : "25"}
            aria-label="Price in dollars"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          />
        </label>
        <button type="button" aria-pressed={free} onClick={() => setFree((v) => !v)} className={`${chip} h-12 px-4 ${free ? on : off}`}>
          🆓 Free
        </button>
      </div>

      <h2 className="mb-2 mt-5 text-[15px] font-semibold">What is it?</h2>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is it?">
        {CURB_KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className={`${chip} ${kind === k.id ? on : off}`}>
            <span aria-hidden>{k.emoji}</span>
            {k.label}
          </button>
        ))}
      </div>

      <label htmlFor="curb-note" className="mb-2 mt-5 text-[15px] font-semibold">
        Note <span className="font-normal text-muted">optional</span>
      </label>
      <textarea
        id="curb-note"
        value={note}
        maxLength={CURB_NOTE_MAX}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Condition, size, pick up by Saturday…"
        className={`resize-none py-3 ${field}`}
      />
      <span className="mt-1 text-xs text-muted">No phone numbers here. Neighbors tap “I&apos;m interested” and you pick who to text.</span>

      {error && (
        <p role="alert" className="mt-3 text-[15px] font-medium text-love">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-6 h-[54px] shrink-0 rounded-[16px] bg-neon text-[16px] font-bold text-on-neon disabled:opacity-60"
      >
        {pending ? "Listing…" : "List it"}
      </button>
    </main>
  );
}
