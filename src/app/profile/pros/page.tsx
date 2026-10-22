import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMyPros } from "@/lib/my-pros";
import ProLogo from "@/components/map/ProLogo";
import ShareListButton from "./ShareListButton";

export const metadata: Metadata = { title: `My pros · ${SITE.name}` };

export default async function MyProsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/profile/pros");
  const pros = await listMyPros(createAdminClient(), user.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/profile" aria-label="Back to profile" className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="mt-7 text-[28px] font-bold tracking-[-0.02em]">My pros</h1>
      <p className="mt-1.5 text-base text-muted">The pros you&apos;ve saved 🔖 or reacted to. Share the list with a neighbor or new move-in.</p>

      <div className="mt-[22px] flex flex-col gap-2.5">
        {pros.length === 0 && (
          <p className="text-[15px] text-muted">Nothing here yet. Tap Save on any pro&apos;s page, or react to the pros you use.</p>
        )}
        {pros.map((p) => (
          <Link
            key={p.id}
            href={`/pro/${p.id}`}
            className="flex items-center gap-3.5 rounded-[18px] bg-surface p-3.5 shadow-card"
          >
            <ProLogo name={p.name} logoUrl={p.logoUrl} size={48} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-base font-bold">{p.name}</span>
              <span className="text-[13px] text-muted">{[p.category, p.saved && "saved"].filter(Boolean).join(" · ") || "Saved"}</span>
            </span>
            {p.reaction && (
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl ${p.reaction === "love" ? "bg-love-tint" : "bg-green-tint"}`} aria-hidden>
                {p.reaction === "love" ? "❤️" : "👍"}
              </span>
            )}
          </Link>
        ))}
      </div>

      {pros.length > 0 && <ShareListButton />}
    </main>
  );
}
