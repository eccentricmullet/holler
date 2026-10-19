"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { REACH_OPTIONS } from "@/lib/reach";
import { setReachAction } from "./actions";

// 📍 1 mi · 🏘️ 3 mi · 🗺️ 5 mi: how far The Porch (and ask alerts) reach.
export default function ReachPicker({ miles }: { miles: number }) {
  const router = useRouter();
  const [current, setCurrent] = useState(miles);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex items-center gap-2" role="radiogroup" aria-label="How far to look">
      {REACH_OPTIONS.map((o) => {
        const on = current === o.miles;
        return (
          <button
            key={o.miles}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            disabled={pending}
            onClick={() => {
              if (on) return;
              setCurrent(o.miles);
              startTransition(async () => {
                await setReachAction(o.miles);
                router.refresh();
              });
            }}
            className={`flex h-9 items-center gap-1 rounded-full border-2 px-3 text-sm font-semibold transition-colors ${
              on ? "border-ink bg-ink text-white" : "border-line text-ink"
            }`}
          >
            <span aria-hidden>{o.emoji}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
