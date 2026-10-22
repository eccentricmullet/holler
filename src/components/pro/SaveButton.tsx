"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSaved } from "@/app/saved-actions";

// Bookmark a pro to "My pros". A bookmark, not a heart, so it isn't mixed up with ❤️ Love them.
export default function SaveButton({ proId, initiallySaved }: { proId: string; initiallySaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Saved to My pros. Tap to remove" : "Save to My pros"}
      onClick={() => {
        const next = !saved;
        setSaved(next);
        startTransition(async () => {
          const r = await toggleSaved(proId, next);
          if (r.needsSignIn) router.push(`/signup?next=${encodeURIComponent(`/pro/${proId}`)}`);
          else if (!r.ok) setSaved(!next);
        });
      }}
      className={`flex h-[46px] items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-semibold transition-colors ${
        saved ? "bg-neon text-on-neon" : "bg-surface text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
