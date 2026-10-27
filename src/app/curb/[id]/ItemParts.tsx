"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/components/Track";
import { interestAction, markGoneAction, reportCurbItemAction } from "../actions";

// Swipe through up to 4 photos, with dots underneath
export function PhotoSwiper({ urls, title }: { urls: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  if (!urls.length) return <div className="aspect-square w-full bg-field" />;
  return (
    <div className="relative">
      <div
        className="no-scrollbar flex aspect-square w-full snap-x snap-mandatory overflow-x-auto bg-field"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={u} src={u} alt={urls.length > 1 ? `${title}, photo ${i + 1} of ${urls.length}` : title} className="size-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      {urls.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden>
          {urls.map((u, i) => (
            <span key={u} className={`size-2 rounded-full shadow-card ${i === index ? "bg-surface" : "bg-surface/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// "I'm interested": puts you on the seller's list and shares your number with them
export function InterestButton({ itemId, initial, seller }: { itemId: string; initial: boolean; seller: string }) {
  const router = useRouter();
  const [interested, setInterested] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await interestAction(itemId, next);
      if (!r.ok) return setError(r.error);
      setInterested(next);
      if (next) track("curb_interested");
      router.refresh();
    });
  }

  if (interested) {
    return (
      <div className="flex flex-col gap-2 rounded-[18px] border border-neon bg-green-wash p-4">
        <p className="text-[17px] font-bold">You&apos;re on {seller}&apos;s list ✓</p>
        <p className="text-[15px] leading-snug text-ink-soft">{seller} has your number and will text you if it&apos;s yours.</p>
        <button type="button" disabled={pending} onClick={() => toggle(false)} className="mt-1 self-start text-sm font-semibold text-green-deep disabled:opacity-60">
          Never mind, take me off the list
        </button>
        {error && <p className="text-sm font-medium text-love">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => toggle(true)}
        className="h-[54px] rounded-[16px] bg-neon text-[16px] font-bold text-on-neon disabled:opacity-60"
      >
        {pending ? "One sec…" : "🙋 I'm interested"}
      </button>
      <p className="px-1 text-center text-[13px] leading-snug text-muted">This shares your phone number with {seller} so they can text you. No one else sees it.</p>
      {error && <p className="text-center text-sm font-medium text-love">{error}</p>}
    </div>
  );
}

// Seller: take it off the Curb (asks once to be sure)
export function GoneButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!sure) return setSure(true);
        startTransition(async () => {
          await markGoneAction(itemId);
          router.refresh();
        });
      }}
      className={`h-[54px] rounded-[16px] text-[16px] font-bold disabled:opacity-60 ${sure ? "bg-ink text-surface" : "border border-line bg-surface text-ink"}`}
    >
      {pending ? "One sec…" : sure ? "Tap again to take it down" : "✅ Mark as gone"}
    </button>
  );
}

const REASONS = ["Not allowed", "Spam or scam", "Already gone"];

// Neighbors: report a listing (3 homes hide it)
export function ReportLink({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  if (done) return <p className="text-center text-sm text-muted">Thanks, we got your report.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center justify-center text-sm font-medium text-muted">
        Report this listing
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-semibold">What&apos;s wrong?</p>
      <div className="flex flex-wrap justify-center gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await reportCurbItemAction(itemId, r);
                setDone(true);
              })
            }
            className="flex h-11 items-center rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium disabled:opacity-60"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
