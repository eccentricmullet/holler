"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePorchCount } from "@/components/PorchButton";

// Bottom navigation: Porch · Curb · [+] · Map · Me. Shown on the four main screens.
const TABS = [
  { href: "/porch", label: "Porch", icon: <path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6" /> },
  { href: "/curb", label: "Curb", icon: <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" /> },
  null, // the + button
  { href: "/", label: "Map", icon: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /> },
  { href: "/profile", label: "Me", icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" /> },
] as const;

const SHOW_ON = new Set(["/", "/porch", "/curb", "/profile"]);

const ACTIONS = [
  { emoji: "👍", label: "Recommend a pro you use", sub: "Put them on the map for neighbors", href: "/react" },
  { emoji: "🔧", label: "Ask for a pro", sub: "Neighbors tell you who they use", href: "/asks/new" },
  { emoji: "🛋️", label: "List on the Curb", sub: "Sell or give away something", href: "/curb" },
  { emoji: "🏷️", label: "Garage sale", sub: "Date, time and what's for sale", href: "/porch/new?kind=garage_sale" },
  { emoji: "🐾", label: "Pet post", sub: "Lost or found pet nearby", href: "/porch/new?tab=pets" },
];

export default function TabBar() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const supabase = useRef(createClient()).current;
  const porchCount = usePorchCount(signedIn);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [supabase]);

  // Close the sheet when moving to another page
  useEffect(() => setOpen(false), [pathname]);

  if (!SHOW_ON.has(pathname)) return null;
  const gate = (href: string) => (signedIn || href === "/curb" ? href : `/signup?next=${encodeURIComponent(href)}`);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-[440px] lg:-translate-x-1/2 lg:rounded-[22px] lg:border lg:pb-0 lg:shadow-float"
      >
        <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
          {TABS.map((t) =>
            t === null ? (
              <li key="plus">
                <button
                  type="button"
                  aria-label="Create"
                  aria-expanded={open}
                  onClick={() => setOpen(true)}
                  className="-mt-5 flex size-14 items-center justify-center rounded-full bg-neon text-on-neon shadow-control ring-4 ring-surface"
                >
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </li>
            ) : (
              <li key={t.href}>
                <Link
                  href={t.href === "/profile" && !signedIn ? "/signup?next=/profile" : t.href}
                  aria-current={pathname === t.href ? "page" : undefined}
                  className="flex min-h-11 w-16 flex-col items-center gap-0.5"
                >
                  <span
                    className={`relative flex h-8 w-14 items-center justify-center rounded-full ${pathname === t.href ? "bg-neon text-on-neon" : "text-muted"}`}
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {t.icon}
                    </svg>
                    {t.href === "/porch" && porchCount > 0 && pathname !== "/porch" && (
                      <span className="absolute -top-1 right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-neon px-1 text-[11px] font-bold text-on-neon ring-2 ring-surface">
                        {porchCount > 9 ? "9+" : porchCount}
                      </span>
                    )}
                  </span>
                  <span className={`text-[12px] leading-none ${pathname === t.href ? "font-bold text-ink" : "font-medium text-muted"}`}>{t.label}</span>
                </Link>
              </li>
            )
          )}
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 lg:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Create"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-[24px] bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-float lg:rounded-[24px]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
            <ul className="flex flex-col gap-1">
              {ACTIONS.map((a) => (
                <li key={a.label}>
                  <Link href={gate(a.href)} className="flex min-h-14 items-center gap-3.5 rounded-[16px] px-3 py-2 hover:bg-page">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-green-tint text-[22px]" aria-hidden>
                      {a.emoji}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[16px] font-semibold">{a.label}</span>
                      <span className="text-[13px] text-muted">{a.sub}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setOpen(false)} className="mt-2 h-12 w-full rounded-[16px] border border-line text-[15px] font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
