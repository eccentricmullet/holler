import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { porchFeed } from "@/lib/porch";
import { isTab, TABS, type PorchTab } from "@/lib/porch-kinds";
import { PORCH_RADIUS_MILES } from "@/lib/reach";
import PorchFeed from "./PorchFeed";
import InstallCard from "@/components/InstallCard";
import { SeenPorch } from "@/components/PorchButton";

export const metadata: Metadata = { title: `Porch · ${SITE.name}` };

// Quick picks on the "Who do you need?" card
const QUICK = ["electrical", "plumbing", "lawn", "hair-salon", "vet"];

const roundBtn = "flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card";
const chipBase = "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px]";

export default async function PorchPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; search?: string }> }) {
  const { tab: tabParam, q = "", search } = await searchParams;
  const tab: PorchTab = isTab(tabParam) ? tabParam : "all";
  const searching = search === "1" || q.length > 0;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("id, households(city)").eq("id", user.id).maybeSingle()
    : { data: null };
  const town = (profile?.households as unknown as { city: string | null } | null)?.city || SITE.launchTownShort;

  // Neighbors only: posts can mention a street or show a photo, so they're not public
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[calc(var(--tabbar)+24px)] pt-6">
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Porch</h1>
        <span className="mt-10 text-[56px]" aria-hidden>
          🏡
        </span>
        <p className="mt-4 text-[15px] leading-snug text-muted">
          Ask neighbors who they use, plus garage sales and lost pets, from verified neighbors within {PORCH_RADIUS_MILES} miles.
        </p>
        <ul className="mt-6 flex flex-col gap-2 text-[15px]">
          <li>🔧 &ldquo;Who do you use for gutters?&rdquo; answered with real pros</li>
          <li>🏷️ Garage sales with times and directions</li>
          <li>🐾 Lost and found pets</li>
        </ul>
        <Link
          href="/signup?next=/porch"
          className="mt-auto flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon"
        >
          Join your neighbors
        </Link>
      </main>
    );
  }

  const [feed, { data: quick }] = await Promise.all([
    porchFeed(createAdminClient(), user!.id, tab, q),
    supabase.from("categories").select("slug, name, icon").in("slug", QUICK),
  ]);
  const quickPicks = QUICK.map((s) => quick?.find((c) => c.slug === s)).filter((c): c is { slug: string; name: string; icon: string } => !!c);
  const tabHref = (id: PorchTab) => `/porch${id === "all" ? "" : `?tab=${id}`}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[calc(var(--tabbar)+24px)] pt-6">
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Porch</h1>
          <span className="text-sm text-muted">
            {town} area · {PORCH_RADIUS_MILES} mi
          </span>
        </div>
        <div className="flex gap-2">
          <Link href={searching ? tabHref(tab) : `/porch?search=1${tab === "all" ? "" : `&tab=${tab}`}`} aria-label={searching ? "Close search" : "Search the Porch"} className={roundBtn}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              {searching ? <path d="M6 6l12 12M18 6L6 18" /> : (
                <>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </>
              )}
            </svg>
          </Link>
          <Link href="/profile/alerts" aria-label="Alerts" className={roundBtn}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
              <path d="M10.3 20a2 2 0 0 0 3.4 0" />
            </svg>
          </Link>
        </div>
      </header>

      {searching && (
        <form action="/porch" className="mt-3 flex h-12 items-center gap-2.5 rounded-full border border-line bg-surface px-4">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            name="q"
            defaultValue={q}
            autoFocus
            enterKeyHint="search"
            placeholder="Search posts, like “gutters” or “cat”"
            aria-label="Search the Porch"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </form>
      )}

      <nav className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4" aria-label="Filter the Porch">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`${tabHref(t.id)}${q ? `${t.id === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`${chipBase} ${tab === t.id ? "bg-neon font-bold text-on-neon" : "border border-line bg-surface font-medium text-ink"}`}
          >
            {t.emoji && <span aria-hidden>{t.emoji}</span>}
            {t.label}
          </Link>
        ))}
      </nav>

      {!searching && (tab === "all" || tab === "pros") && (
        <section className="mt-3 flex flex-col gap-3 rounded-[18px] bg-surface p-4 shadow-card" aria-label="Ask for a pro">
          <Link href="/asks/new" className="flex h-11 items-center gap-2.5 rounded-xl bg-field px-3.5 text-[15px] text-muted">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-green-deep" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Who do you need?
          </Link>
          <div className="flex flex-wrap gap-1.5">
            {quickPicks.map((c) => (
              <Link
                key={c.slug}
                href={`/asks/new?category=${c.slug}`}
                className="flex h-11 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold"
              >
                <span aria-hidden>{c.icon}</span> {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-3">
        <PorchFeed items={feed} tab={tab} search={q} />
      </div>
      <InstallCard className="mt-4" />
      <SeenPorch />
    </main>
  );
}
