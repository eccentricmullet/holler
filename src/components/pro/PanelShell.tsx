"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Side panel on laptops (map stays visible on the left), full screen on phones.
export default function PanelShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.back();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      className="fixed inset-0 z-30 overflow-y-auto bg-surface lg:inset-auto lg:bottom-5 lg:right-5 lg:top-5 lg:w-[420px] lg:rounded-[18px] lg:shadow-float"
    >
      {children}
    </div>
  );
}

export function PanelCloseButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Close"
      className="flex size-[46px] items-center justify-center rounded-2xl bg-surface text-ink"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
