"use client";

import { useState } from "react";

// Opens the phone's share sheet; on computers, copies the link instead.
export default function ShareButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text: `Neighbors trust ${name}`, url });
      } catch {
        // closed the share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; nothing else to do
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Link copied" : "Share this pro"}
      className="flex h-[46px] min-w-[46px] items-center justify-center gap-1.5 rounded-2xl bg-surface px-3 text-ink"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
      </svg>
      {copied && <span className="text-sm font-semibold">Copied</span>}
    </button>
  );
}
