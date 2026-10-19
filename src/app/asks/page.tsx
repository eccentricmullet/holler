import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asksNear, myAsks } from "@/lib/asks";
import ProLogo from "@/components/map/ProLogo";
import { closeAskAction } from "./actions";
import { aCategoryPro } from "@/lib/words";

export const metadata: Metadata = { title: `Asks · ${SITE.name}` };

const card = "rounded-[20px] bg-surface p-4 shadow-[0_6px_18px_rgba(26,29,36,0.08)]";

// Neighbors asking who to hire (answer with a pro), and your own asks with the pros neighbors suggested.
export default async function AsksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/asks");
  const db = createAdminClient();
  const [near, mine] = await Promise.all([asksNear(db, user.id), myAsks(db, user.id)]);
  const open = near.filter((a) => !a.answeredByMe);
  const answered = near.filter((a) => a.answeredByMe);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/" aria-label="Back to map" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="mt-7 text-[34px] font-extrabold tracking-[-0.02em]">Neighbors asking</h1>
      <p className="mt-1.5 text-base text-muted">Know a good one? Tap to share a pro. It also goes on the map.</p>
      <Link href="/profile/alerts" className="mt-2 text-sm font-semibold text-green-deep">
        🔔 Get an alert when a neighbor asks or answers
      </Link>

      <div className="mt-5 flex flex-col gap-2.5">
        {open.length === 0 && <p className="text-[15px] text-muted">No one near you is asking right now.</p>}
        {open.map((a) => (
          <Link key={a.id} href={`/react?ask=${a.id}`} className={`${card} flex items-center gap-3.5`}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-green-tint text-2xl" aria-hidden>
              {a.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base font-bold">
                {a.who} needs {aCategoryPro(a.categoryName)}
              </span>
              <span className="text-[13px] text-muted">
                {a.when}
                {a.answers ? ` · ${a.answers} answered` : ""}
              </span>
            </span>
            <span className="shrink-0 rounded-xl bg-green-deep px-3 py-2 text-sm font-semibold text-white">I know one</span>
          </Link>
        ))}
        {answered.length > 0 && <p className="px-1 text-[13px] text-muted">You&apos;ve helped with {answered.length} more. Thanks!</p>}
      </div>

      <h2 className="mt-9 text-xl font-bold">Your asks</h2>
      <div className="mt-3 flex flex-col gap-2.5">
        {mine.length === 0 && (
          <p className="text-[15px] text-muted">
            Need someone? Pick a category on the map and tap <span className="font-semibold">Ask your neighbors</span>.
          </p>
        )}
        {mine.map((a) => (
          <div key={a.id} className={card}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-bold">
                <span aria-hidden>{a.icon}</span> {a.categoryName}
              </span>
              <span className="text-[13px] text-muted">
                {a.when}
                {!a.open && " · closed"}
              </span>
            </div>
            {a.suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Waiting on neighbors…</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {a.suggestions.map((s) => (
                  <Link key={s.proId} href={`/pro/${s.proId}`} className="flex items-center gap-3 rounded-2xl bg-field p-2.5">
                    <ProLogo name={s.name} logoUrl={s.logoUrl} size={36} />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{s.name}</span>
                    <span className="text-[13px] text-muted">
                      {s.count} {s.count === 1 ? "neighbor" : "neighbors"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {a.open && (
              <form action={closeAskAction.bind(null, a.id)} className="mt-3">
                <button type="submit" className="text-sm font-semibold text-muted">
                  Found someone, close this ask
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
