import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curbFeed, myCurbItems } from "@/lib/curb";
import { CURB_DAYS, CURB_FILTERS, isCurbFilter, type CurbFilter } from "@/lib/curb-kinds";
import { PORCH_RADIUS_MILES } from "@/lib/reach";

export const metadata: Metadata = { title: `The Curb · ${SITE.name}` };

const roundBtn = "flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card";
const chipBase = "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px]";

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default async function CurbPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; search?: string }> }) {
  const { f, q = "", search } = await searchParams;
  const filter: CurbFilter = isCurbFilter(f) ? f : "all";
  const searching = search === "1" || q.length > 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()
    : { data: null };

  // Neighbors only: listings show photos and a neighborhood, so they're not public
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[calc(var(--tabbar)+24px)] pt-6">
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">The Curb</h1>
        <span className="mt-10 text-[56px]" aria-hidden>
          🛋️
        </span>
        <p className="mt-4 text-[15px] leading-snug text-muted">
          Free stuff and good deals from verified neighbors within {PORCH_RADIUS_MILES} miles.
        </p>
        <ul className="mt-6 flex flex-col gap-2 text-[15px]">
          <li>📣 Free stuff on the curb, before it&apos;s gone</li>
          <li>🧸 Kids&apos; gear, furniture and tools for less</li>
          <li>📸 Snap a photo and list in a minute</li>
        </ul>
        <Link href="/signup?next=/curb" className="mt-auto flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon">
          Join your neighbors
        </Link>
      </main>
    );
  }

  const db = createAdminClient();
  const [items, mine] = await Promise.all([curbFeed(db, user!.id, filter, q), myCurbItems(db, user!.id)]);
  const myLive = mine.filter((i) => i.live);
  const filterHref = (id: CurbFilter) => {
    const p = new URLSearchParams();
    if (id !== "all") p.set("f", id);
    if (q) p.set("q", q);
    const s = p.toString();
    return `/curb${s ? `?${s}` : ""}`;
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[calc(var(--tabbar)+24px)] pt-6">
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">The Curb</h1>
          <span className="text-sm text-muted">Free and for sale near you</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={searching ? (filter === "all" ? "/curb" : `/curb?f=${filter}`) : `/curb?search=1${filter === "all" ? "" : `&f=${filter}`}`}
            aria-label={searching ? "Close search" : "Search the Curb"}
            className={roundBtn}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              {searching ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </>
              )}
            </svg>
          </Link>
          <Link href="/curb/new" className="flex h-11 items-center gap-1.5 rounded-full bg-neon px-4 text-sm font-bold text-on-neon">
            <PlusIcon />
            List item
          </Link>
        </div>
      </header>

      {searching && (
        <form action="/curb" className="mt-3 flex h-12 items-center gap-2.5 rounded-full border border-line bg-surface px-4">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            autoFocus
            enterKeyHint="search"
            placeholder="Search, like “crib” or “mower”"
            aria-label="Search the Curb"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </form>
      )}

      <nav className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4" aria-label="Filter the Curb">
        {CURB_FILTERS.map((c) => (
          <Link
            key={c.id}
            href={filterHref(c.id)}
            aria-current={filter === c.id ? "page" : undefined}
            className={`${chipBase} ${filter === c.id ? "bg-neon font-bold text-on-neon" : "border border-line bg-surface font-medium text-ink"}`}
          >
            {c.emoji && <span aria-hidden>{c.emoji}</span>}
            {c.label}
          </Link>
        ))}
      </nav>

      {myLive.length > 0 && !searching && (
        <section className="mt-4" aria-label="Your items">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Your items</h2>
          <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
            {myLive.map((i) => (
              <Link key={i.id} href={`/curb/${i.id}`} className="flex h-14 shrink-0 items-center gap-2.5 rounded-[14px] bg-surface py-1.5 pl-1.5 pr-3.5 shadow-card">
                {i.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.photoUrl} alt="" className="size-11 rounded-[10px] object-cover" />
                ) : (
                  <span className="size-11 rounded-[10px] bg-field" />
                )}
                <span className="flex max-w-[160px] flex-col">
                  <span className="truncate text-sm font-semibold">{i.title}</span>
                  <span className={`text-[12px] ${i.interested ? "font-semibold text-green-deep" : "text-muted"}`}>
                    {i.interested ? `${i.interested} interested` : i.priceLabel}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-[18px] bg-surface p-8 text-center shadow-card">
          <span className="text-[44px]" aria-hidden>
            {q ? "🔎" : "🛋️"}
          </span>
          <h2 className="mt-3 text-[20px] font-bold">{q ? "Nothing matches that" : filter === "all" ? "The Curb is empty" : "Nothing here yet"}</h2>
          <p className="mt-2 text-[15px] leading-snug text-muted">
            {q ? "Try another word." : `Clearing out? List it here. Free things get a 📣 Curb alert, and listings come down after ${CURB_DAYS} days.`}
          </p>
          {!q && (
            <Link href="/curb/new" className="mt-5 flex h-12 items-center gap-1.5 rounded-full bg-neon px-5 text-[15px] font-bold text-on-neon">
              <PlusIcon />
              List an item
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/curb/${i.id}`} className="flex h-full flex-col overflow-hidden rounded-[16px] bg-surface shadow-card">
                <span className="relative block aspect-square bg-field">
                  {i.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
                  )}
                  {i.price === 0 && (
                    <span className="absolute left-2 top-2 flex h-[26px] items-center rounded-full bg-neon px-2.5 text-[11px] font-bold text-on-neon">📣 Curb alert</span>
                  )}
                </span>
                <span className="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
                  <span className="text-base font-bold">{i.priceLabel}</span>
                  <span className="truncate text-sm font-medium">{i.title}</span>
                  <span className="truncate text-[12px] text-muted">
                    {i.mine ? "Yours" : [i.hood, i.distance].filter(Boolean).join(" · ")}
                    {` · ${i.when}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
