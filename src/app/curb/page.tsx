import type { Metadata } from "next";
import { SITE } from "@/config/site";

export const metadata: Metadata = { title: `The Curb · ${SITE.name}` };

// Placeholder until the Curb is built (redesign phase 4)
export default function CurbPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[calc(var(--tabbar)+24px)] pt-6">
      <h1 className="text-[28px] font-bold tracking-[-0.02em]">The Curb</h1>
      <p className="mt-1 text-[15px] text-muted">Free stuff and good deals from neighbors.</p>
      <div className="mt-8 flex flex-col items-center rounded-[18px] bg-surface p-8 text-center shadow-card">
        <span className="text-[44px]" aria-hidden>
          🛋️
        </span>
        <h2 className="mt-3 text-[20px] font-bold">Coming soon</h2>
        <p className="mt-2 text-[15px] leading-snug text-muted">
          List furniture, kids&apos; stuff and tools, or give things away. Free items get a 📣 Curb alert.
        </p>
      </div>
    </main>
  );
}
