"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { shareInvite } from "@/components/InviteButton";
import { joinWaitlistAction } from "./actions";
import { track } from "@/components/Track";
import { SITE } from "@/config/site";

export default function UnlockForm({ threshold, launchTown }: { threshold: number; launchTown: string }) {
  const [contact, setContact] = useState("");
  const [zip, setZip] = useState("");
  const [town, setTown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ count: number; already: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const pct = result ? Math.min(100, Math.round((result.count / threshold) * 100)) : 0;
  const place = town.trim() || zip;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden bg-page">
      <div className="relative px-6 pb-10 pt-8 text-ink">
        <Link href="/" className="relative text-sm font-semibold text-green-deep">
          ‹ See the map
        </Link>
        <h1 className="relative mt-8 text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">Bring {SITE.name} to your town</h1>
        <p className="relative mt-3 text-[15px] leading-snug text-muted">
          A map of the pros your neighbors trust. We&apos;re starting in {launchTown}. When {threshold} neighbors in your ZIP join
          the list, we unlock your town.
        </p>
      </div>

      <div className="relative -mt-6 flex flex-1 flex-col rounded-t-[24px] bg-surface px-6 pb-6 pt-7 shadow-card">
        {result ? (
          <>
            <span className="text-[44px]" aria-hidden>
              🎉
            </span>
            <h2 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em]">
              {result.already ? "You're already on the list" : "You're on the list!"}
            </h2>
            <p className="mt-2 text-base text-muted">
              {result.count} of {threshold} neighbors in {place}. Every neighbor you invite gets your town closer.
            </p>
            <div className="mt-5 h-4 overflow-hidden rounded-full bg-field" role="progressbar" aria-valuenow={result.count} aria-valuemax={threshold}>
              <div className="h-full rounded-full bg-neon" style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
            <button
              type="button"
              onClick={shareInvite}
              className="mt-auto flex h-[54px] items-center justify-center rounded-[18px] bg-neon text-[17px] font-semibold text-on-neon"
            >
              📣 Invite your neighbors
            </button>
          </>
        ) : (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                const r = await joinWaitlistAction({ contact, zip, town });
                if (!r.ok) setError(r.error);
                else {
                  setResult({ count: r.count, already: r.already });
                  track("joined_waitlist", { zip, already: r.already });
                }
              });
            }}
          >
            <label htmlFor="contact" className="mb-2 text-[15px] font-semibold">
              Phone or email
            </label>
            <input
              id="contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              autoComplete="email"
              placeholder="(615) 555-0123 or you@email.com"
              className="h-14 rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted"
            />
            <div className="mt-5 flex gap-3">
              <div className="flex w-32 flex-col">
                <label htmlFor="zip" className="mb-2 text-[15px] font-semibold">
                  ZIP code
                </label>
                <input
                  id="zip"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="37174"
                  className="h-14 rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <label htmlFor="town" className="mb-2 text-[15px] font-semibold">
                  Town <span className="font-normal text-muted">optional</span>
                </label>
                <input
                  id="town"
                  value={town}
                  maxLength={60}
                  autoComplete="address-level2"
                  onChange={(e) => setTown(e.target.value)}
                  className="h-14 rounded-[16px] border border-line bg-surface px-4 text-base outline-none"
                />
              </div>
            </div>
            <p className="mt-3 text-[13px] text-muted">We&apos;ll only reach out when your town unlocks.</p>
            {error && (
              <p role="alert" className="mt-3 text-[15px] font-medium text-love">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="mt-auto h-[54px] rounded-[16px] bg-neon text-[17px] font-semibold text-on-neon disabled:opacity-60"
            >
              {pending ? "One sec…" : "Join the list"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
