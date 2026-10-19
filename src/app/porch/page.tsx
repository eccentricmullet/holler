import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { porchFeed } from "@/lib/porch";
import { TABS, type PorchTab } from "@/lib/porch-kinds";
import PorchFeed from "./PorchFeed";
import ReachPicker from "./ReachPicker";
import { DEFAULT_REACH } from "@/lib/reach";
import { SeenPorch } from "@/components/PorchButton";

export const metadata: Metadata = { title: `The Porch · ${SITE.name}` };

export default async function PorchPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: PorchTab = TABS.some((t) => t.id === tabParam) ? (tabParam as PorchTab) : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("id, reach_miles").eq("id", user.id).maybeSingle() : { data: null };

  const header = (
    <div className="flex items-center justify-between">
      <Link href="/" aria-label="Back to map" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      {profile && (
        <Link href={`/porch/new${tab !== "all" ? `?tab=${tab}` : ""}`} className="flex h-[46px] items-center gap-1.5 rounded-2xl bg-green-deep px-4 text-[15px] font-semibold text-white">
          <span aria-hidden className="text-lg leading-none">+</span> Post
        </Link>
      )}
    </div>
  );

  // Neighbors only: posts can mention a street or show a photo, so they're not public
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        {header}
        <span className="mt-12 text-[56px]" aria-hidden>
          🏡
        </span>
        <h1 className="mt-4 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">The Porch</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">
          Garage sales, curb alerts, lost pets, local events and who just did great work, from verified neighbors near you.
        </p>
        <ul className="mt-6 flex flex-col gap-2 text-[15px]">
          <li>🏷️ Garage sales and free stuff on the curb</li>
          <li>🐾 Lost and found pets</li>
          <li>📸 &ldquo;Just hired&rdquo; shout-outs for great pros</li>
          <li>⚠️ Road closures, storms and outages</li>
        </ul>
        <Link
          href="/signup?next=/porch"
          className="mt-auto flex h-[58px] items-center justify-center rounded-[20px] bg-green-deep text-[17px] font-semibold text-white"
        >
          Join your neighbors
        </Link>
      </main>
    );
  }

  const feed = await porchFeed(createAdminClient(), user!.id, tab);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      {header}
      <h1 className="mt-6 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">The Porch</h1>
      <p className="mt-1.5 text-[15px] text-muted">What&apos;s happening near you. Posts tidy themselves up.</p>
      <ReachPicker miles={profile.reach_miles ?? DEFAULT_REACH} />

      <nav className="no-scrollbar -mx-6 mt-4 flex gap-2 overflow-x-auto px-6" aria-label="Porch tabs">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/porch" : `/porch?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold ${
              tab === t.id ? "border-green-deep bg-green text-white" : "border-line bg-surface"
            }`}
          >
            <span aria-hidden>{t.emoji}</span>
            {t.label}
          </Link>
        ))}
      </nav>

      <PorchFeed items={feed} tab={tab} />
      <SeenPorch />
    </main>
  );
}
