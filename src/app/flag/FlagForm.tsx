"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { fileFlag } from "./actions";
import { NOTE_REASONS, PRO_REASONS } from "./reasons";

export default function FlagForm({
  target,
  label,
  backHref,
}: {
  target: { kind: "pro" | "note"; id: string };
  label: string;
  backHref: string;
}) {
  const reasons = target.kind === "pro" ? PRO_REASONS : NOTE_REASONS;
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <span className="mt-20 size-20 rounded-[28px] bg-green-tint text-center text-[42px] leading-[80px]" aria-hidden>
          🙏
        </span>
        <h1 className="mt-6 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">Thanks for telling us</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">
          Only the admin sees this. Nothing about it shows on the map or the pro&apos;s page.
        </p>
        <Link
          href={backHref}
          className="mt-auto flex h-[58px] items-center justify-center rounded-[20px] bg-green-deep text-[17px] font-semibold text-white"
        >
          Done
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href={backHref} aria-label="Back" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="mt-7 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
        {target.kind === "pro" ? "Had a bad experience?" : "Report this note"}
      </h1>
      <p className="mt-2.5 text-base leading-snug text-muted">
        {target.kind === "pro" ? (
          <>
            About <span className="font-semibold text-ink">{label}</span>. This is private: only the admin sees it.
          </>
        ) : (
          <>
            <span className="text-ink">{label}</span> Only the admin sees reports.
          </>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-2.5" role="radiogroup" aria-label="Reason">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={`flex h-[52px] items-center rounded-[18px] border-2 px-4 text-left text-base font-semibold ${
              reason === r ? "border-green bg-green-wash" : "border-line"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <label htmlFor="details" className="mt-6 text-[15px] font-semibold">
        What happened? <span className="font-normal text-muted">optional</span>
      </label>
      <textarea
        id="details"
        rows={3}
        maxLength={1000}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        className="mt-2 resize-none rounded-[18px] bg-field px-4 py-3.5 text-base outline-none"
      />

      {error && (
        <p role="alert" className="mt-3 text-[15px] font-medium text-love">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending || !reason}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await fileFlag({ kind: target.kind, id: target.id, reason: reason!, details });
            if (r.error) setError(r.error);
            else setSent(true);
          });
        }}
        className="mt-auto h-[58px] rounded-[20px] bg-green-deep text-[17px] font-semibold text-white disabled:opacity-40"
      >
        {pending ? "One sec…" : "Send privately"}
      </button>
    </main>
  );
}
