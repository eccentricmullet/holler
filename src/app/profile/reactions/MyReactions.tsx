"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import ProLogo from "@/components/map/ProLogo";
import { removeReaction, setNote, setReaction } from "../actions";

export type MyReaction = {
  id: string;
  reaction: "thumbs_up" | "love";
  note: string | null;
  proId: string;
  proName: string;
  logoUrl: string | null;
  categoryName: string;
};

const NOTE_MAX = 140;

export default function MyReactions({ reactions, hidden }: { reactions: MyReaction[]; hidden: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const thumbs = reactions.filter((r) => r.reaction === "thumbs_up").length;
  const love = reactions.length - thumbs;

  function run(action: () => Promise<{ error?: string }>, close = true) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else if (close) setOpenId(null);
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/profile" aria-label="Back to profile" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>

      <h1 className="mt-7 text-[34px] font-extrabold tracking-[-0.02em]">My reactions</h1>
      <p className="mt-1.5 text-base text-muted">
        👍 {thumbs} · ❤️ {love} · {hidden ? "you're hidden on the map" : "shown near your block"}
      </p>

      <div className="mt-[22px] flex flex-col gap-2.5">
        {reactions.length === 0 && <p className="text-[15px] text-muted">No reactions yet. Who do you use and trust?</p>}
        {reactions.map((r) => {
          const open = openId === r.id;
          return (
            <div key={r.id} className="rounded-[20px] bg-surface p-3.5 shadow-[0_6px_18px_rgba(26,29,36,0.08)]">
              <div className="flex items-center gap-3.5">
                <Link href={`/pro/${r.proId}`} className="flex min-w-0 flex-1 items-center gap-3.5">
                  <ProLogo name={r.proName} logoUrl={r.logoUrl} size={48} />
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className="truncate text-base font-bold">{r.proName}</span>
                    <span className="text-[13px] text-muted">
                      {r.categoryName} · {r.note ? "with a note" : "no note"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Your reaction: ${r.reaction === "love" ? "love them" : "thumbs up"}. Change it`}
                  aria-expanded={open}
                  onClick={() => {
                    setError(null);
                    setNoteDraft(r.note ?? "");
                    setOpenId(open ? null : r.id);
                  }}
                  className={`size-12 shrink-0 rounded-2xl text-[22px] ${r.reaction === "love" ? "bg-love-tint" : "bg-green-tint"}`}
                >
                  {r.reaction === "love" ? "❤️" : "👍"}
                </button>
              </div>

              {open && (
                <div className="mt-3 flex flex-col gap-2.5 border-t border-line pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={r.reaction === "thumbs_up"}
                      onClick={() => run(() => setReaction(r.id, "thumbs_up"))}
                      className={`h-11 flex-1 rounded-2xl border-2 text-[15px] font-semibold ${
                        r.reaction === "thumbs_up" ? "border-green-deep bg-green text-white" : "border-line text-muted"
                      }`}
                    >
                      👍 Thumbs up
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={r.reaction === "love"}
                      onClick={() => run(() => setReaction(r.id, "love"))}
                      className={`h-11 flex-1 rounded-2xl border-2 text-[15px] font-semibold ${
                        r.reaction === "love" ? "border-love bg-love text-white" : "border-line text-muted"
                      }`}
                    >
                      ❤️ Love them
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={NOTE_MAX}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="What made them good?"
                    aria-label="Your note"
                    className="resize-none rounded-2xl bg-field px-3.5 py-3 text-[15px] outline-none placeholder:text-muted"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Remove your reaction to ${r.proName}?`)) run(() => removeReaction(r.id));
                      }}
                      className="text-sm font-medium text-love"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      disabled={pending || noteDraft === (r.note ?? "")}
                      onClick={() => run(() => setNote(r.id, noteDraft))}
                      className="h-10 rounded-xl bg-green-deep px-4 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Save note
                    </button>
                  </div>
                  {error && (
                    <p role="alert" className="text-sm font-medium text-love">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Link
        href="/react"
        className="mt-3.5 flex h-14 items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-lime text-base font-semibold text-green-deep"
      >
        + React to another pro
      </Link>

      <p className="mx-1 mt-[18px] text-sm leading-snug text-muted">Tap an emoji to switch between 👍 and ❤️, edit your note, or remove it.</p>

      <Link href="/profile/details#delete" className="mt-auto self-center p-2 text-sm font-medium text-love">
        Delete my account and reactions
      </Link>
    </main>
  );
}
