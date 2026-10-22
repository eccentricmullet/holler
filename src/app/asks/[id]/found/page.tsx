import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { myAsks, myOpenAsk } from "@/lib/asks";
import ProLogo from "@/components/map/ProLogo";
import { closeAskAction } from "../../actions";

export const metadata: Metadata = { title: `Found someone · ${SITE.name}` };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Who did you go with?" Picking a pro opens the usual 👍/❤️ screen, which then closes the request.
export default async function FoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=/asks/${id}/found`);
  const db = createAdminClient();
  const ask = await myOpenAsk(db, user.id, id);
  if (!ask) redirect("/asks");
  const suggestions = (await myAsks(db, user.id)).find((a) => a.id === id)?.suggestions ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/porch" aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <span className="mt-8 text-[44px]" aria-hidden>
        🎉
      </span>
      <h1 className="mt-3 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Who did you go with?</h1>
      <p className="mt-2 text-[15px] leading-snug text-muted">
        Your pick closes the request and counts as your 👍 for them, so the next neighbor needing {ask.icon} {ask.categoryName.toLowerCase()} help
        finds them faster.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {suggestions.map((s) => (
          <Link
            key={s.proId}
            href={`/react?pro=${s.proId}&found=${id}`}
            className="flex min-h-14 items-center gap-3 rounded-[18px] bg-surface p-3 shadow-card"
          >
            <ProLogo name={s.name} logoUrl={s.logoUrl} color={s.color} size={40} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold">{s.name}</span>
              <span className="text-[13px] text-muted">
                Recommended by {s.count} {s.count === 1 ? "neighbor" : "neighbors"}
              </span>
            </span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>
        ))}
        <Link href={`/react?found=${id}&category=${ask.categorySlug}`} className="flex min-h-14 items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-field text-lg" aria-hidden>
            🔎
          </span>
          <span className="text-[15px] font-semibold">Someone else</span>
        </Link>
      </div>

      <form action={closeAskAction.bind(null, id)} className="mt-auto pt-6">
        <button type="submit" className="h-12 w-full text-[15px] font-semibold text-muted">
          Close without picking
        </button>
      </form>
    </main>
  );
}
