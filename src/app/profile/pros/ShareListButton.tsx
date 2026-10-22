"use client";

import { useState, useTransition } from "react";
import { getShareCode } from "@/app/saved-actions";
import { track } from "@/components/Track";

// Shares a link to a clean public page of this person's pros.
export default function ShareListButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-auto pt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const r = await getShareCode();
            if (!r.code) return setMsg(r.error ?? "Couldn't make a link.");
            const url = `${window.location.origin}/list/${r.code}`;
            track("shared_pro", { kind: "my_pros_list" });
            if (navigator.share) {
              try {
                await navigator.share({ text: "Here are the local pros I use and trust:", url });
              } catch {
                // closed the share sheet
              }
            } else {
              try {
                await navigator.clipboard.writeText(url);
                setMsg("Link copied ✓");
              } catch {
                setMsg(url);
              }
            }
          })
        }
        className="h-[54px] w-full rounded-[18px] bg-neon text-[17px] font-semibold text-on-neon disabled:opacity-60"
      >
        {pending ? "One sec…" : "📣 Share my list"}
      </button>
      {msg && <p className="mt-2 text-center text-sm font-medium text-green-deep">{msg}</p>}
    </div>
  );
}
