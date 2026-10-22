import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { porchFeed } from "@/lib/porch";
import { TABS, type PorchTab } from "@/lib/porch-kinds";
import PorchFeed from "./PorchFeed";
import ReachPicker from "./ReachPicker";
import InstallCard from "@/components/InstallCard";
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
    <div className="flex min-h-11 items-center justify-between">
      <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Porch</h1>
      {profile && (
        <Link href={`/porch/new${tab !== "all" ? `?tab=${tab}` : ""}`} className="flex h-11 items-center gap-1.5 rounded-full bg-neon px-4 text-[15px] font-semibold text-on-neon">
          <span aria-hidden className="text-lg leading-none">+</span> Post
        </Link>
      )}
    </div>
  );

  // Neighbors only: posts can mention a street or show a photo, so they're not public
  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6 pb-[calc(var(--tabbar)+24px)]">
        {header}
        <span className="mt-10 text-[56px]" aria-hidden>
          🏡
        </span>
        <p className="mt-4 text-base leading-snug text-muted">
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
          className="mt-auto flex h-[54px] items-center justify-center rounded-[18px] bg-neon text-[17px] font-semibold text-on-neon"
        >
          Join your neighbors
        </Link>
      </main>
    );
  }

  const feed = await porchFeed(createAdminClient(), user!.id, tab);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6 pb-[calc(var(--tabbar)+24px)]">
      {header}
      <p className="mt-1.5 text-[15px] text-muted">What&apos;s happening near you. Posts tidy themselves up.</p>
      <ReachPicker miles={profile.reach_miles ?? DEFAULT_REACH} />

      <nav className="no-scrollbar -mx-6 mt-4 flex gap-2 overflow-x-auto px-6" aria-label="Porch tabs">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? "/porch" : `/porch?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
              tab === t.id ? "border-neon bg-neon text-on-neon" : "border-line bg-surface"
            }`}
          >
            <span aria-hidden>{t.emoji}</span>
            {t.label}
          </Link>
        ))}
      </nav>

      <InstallCard className="mt-4" />
      <PorchFeed items={feed} tab={tab} />
      <SeenPorch />
    </main>
  );
}
