"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteAccount, updateDetails } from "../actions";

type Details = { firstName: string; lastInitial: string; privacy: "block" | "hidden" };

export default function DetailsForm({ initial }: { initial: Details }) {
  const [d, setD] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = d.firstName !== initial.firstName || d.lastInitial !== initial.lastInitial || d.privacy !== initial.privacy;
  const displayName = `${d.firstName.trim() || "You"} ${(d.lastInitial || "?").toUpperCase()}.`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/profile" aria-label="Back to profile" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="mt-7 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">Privacy and details</h1>

      <form
        className="flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          startTransition(async () => {
            const r = await updateDetails(d);
            if (r.error) setError(r.error);
            else setSaved(true);
          });
        }}
      >
        <label htmlFor="first" className="mb-2 mt-6 text-[15px] font-semibold">
          First name
        </label>
        <input
          id="first"
          value={d.firstName}
          maxLength={40}
          onChange={(e) => setD({ ...d, firstName: e.target.value })}
          className="h-14 rounded-[18px] bg-field px-4 text-base outline-none"
        />
        <label htmlFor="initial" className="mb-2 mt-5 text-[15px] font-semibold">
          Last initial
        </label>
        <input
          id="initial"
          value={d.lastInitial}
          maxLength={1}
          onChange={(e) => setD({ ...d, lastInitial: e.target.value.replace(/[^a-z]/gi, "").toUpperCase() })}
          className="h-14 w-24 rounded-[18px] bg-field px-4 text-center text-base outline-none"
        />

        <h2 className="mb-3 mt-7 text-xl font-bold">How should you show on the map?</h2>
        <div className="flex flex-col gap-3">
          <Choice
            selected={d.privacy === "block"}
            onClick={() => setD({ ...d, privacy: "block" })}
            emoji="📍"
            title="Near my block"
            body={`Neighbors see “${displayName}” and your pros on your block, never your house.`}
          />
          <Choice
            selected={d.privacy === "hidden"}
            onClick={() => setD({ ...d, privacy: "hidden" })}
            emoji="🕶️"
            title="Keep me hidden"
            body="Your 👍 and ❤️ still count. No pin, and you show as “a neighbor.”"
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[15px] font-medium text-love">
            {error}
          </p>
        )}
        {saved && !changed && <p className="mt-4 text-[15px] font-medium text-green-deep">Saved ✓</p>}

        <button
          type="submit"
          disabled={pending || !changed}
          className="mt-6 h-[58px] rounded-[20px] bg-green-deep text-[17px] font-semibold text-white disabled:opacity-40"
        >
          {pending ? "One sec…" : "Save changes"}
        </button>
      </form>

      <p className="mt-6 text-sm leading-snug text-muted">
        Moved? Delete your account below and sign up again with your new address.
      </p>

      <section id="delete" className="mt-8 rounded-[22px] border-2 border-line p-5">
        <h2 className="text-lg font-bold">Delete my account</h2>
        <p className="mt-1.5 text-sm leading-snug text-muted">
          This removes your reactions, notes, name and home right away. It can&apos;t be undone.
        </p>
        <label htmlFor="confirm" className="mb-2 mt-4 block text-sm font-semibold">
          Type DELETE to confirm
        </label>
        <input
          id="confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className="h-12 w-full rounded-2xl bg-field px-4 text-base outline-none"
        />
        {deleteError && (
          <p role="alert" className="mt-3 text-sm font-medium text-love">
            {deleteError}
          </p>
        )}
        <button
          type="button"
          disabled={pending || confirmText.trim().toUpperCase() !== "DELETE"}
          onClick={() => {
            setDeleteError(null);
            startTransition(async () => {
              const r = await deleteAccount(confirmText);
              if (r?.error) setDeleteError(r.error);
            });
          }}
          className="mt-4 h-12 w-full rounded-2xl bg-love text-[15px] font-semibold text-white disabled:opacity-40"
        >
          Delete my account and reactions
        </button>
      </section>
    </main>
  );
}

function Choice(props: { selected: boolean; onClick: () => void; emoji: string; title: string; body: string }) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
      className={`flex items-start gap-3.5 rounded-[22px] border-[2.5px] p-4 text-left ${
        props.selected ? "border-green bg-green-wash" : "border-line bg-surface"
      }`}
    >
      <span className={`size-12 shrink-0 rounded-2xl text-center text-2xl leading-[48px] ${props.selected ? "bg-surface" : "bg-field"}`} aria-hidden>
        {props.emoji}
      </span>
      <span className="flex flex-col gap-[3px]">
        <span className="text-[17px] font-bold">{props.title}</span>
        <span className="text-sm leading-[1.35] text-muted">{props.body}</span>
      </span>
    </button>
  );
}
