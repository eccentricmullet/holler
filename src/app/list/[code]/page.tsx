import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMyPros } from "@/lib/my-pros";
import ProLogo from "@/components/map/ProLogo";

type Params = { params: Promise<{ code: string }> };

// Public page for a shared "My pros" list. Shows first name + last initial only
// (or "A neighbor" for people who chose to stay hidden), never anything else about them.
async function load(code: string) {
  if (!/^[a-z0-9]{6,16}$/.test(code)) return null;
  const db = createAdminClient();
  const { data: owner } = await db
    .from("profiles")
    .select("id, first_name, last_initial, privacy, banned")
    .eq("share_code", code)
    .maybeSingle();
  if (!owner || owner.banned) return null;
  const who = owner.privacy === "hidden" ? "A neighbor" : `${owner.first_name} ${owner.last_initial}.`;
  return { who, pros: await listMyPros(db, owner.id) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).code);
  if (!data) return { title: SITE.name };
  const title = `${data.who}'s ${SITE.launchTownShort} pros`;
  const description = `${data.pros.length} local pros ${data.who} uses and trusts, on ${SITE.name}.`;
  return { title: `${title} · ${SITE.name}`, description, openGraph: { title, description, siteName: SITE.name } };
}

export default async function SharedListPage({ params }: Params) {
  const data = await load((await params).code);
  if (!data) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <span className="mt-6 text-sm font-semibold text-green-deep">{SITE.wordmark}</span>
      <h1 className="mt-3 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
        {data.who}&apos;s {SITE.launchTownShort} pros
      </h1>
      <p className="mt-2 text-base text-muted">The local pros {data.who === "A neighbor" ? "they use" : data.who.split(" ")[0] + " uses"} and trusts.</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {data.pros.length === 0 && <p className="text-[15px] text-muted">No pros on this list yet.</p>}
        {data.pros.map((p) => (
          <Link
            key={p.id}
            href={`/pro/${p.id}`}
            className="flex items-center gap-3.5 rounded-[20px] bg-surface p-3.5 shadow-[0_6px_18px_rgba(26,29,36,0.08)]"
          >
            <ProLogo name={p.name} logoUrl={p.logoUrl} size={48} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-base font-bold">{p.name}</span>
              {p.category && <span className="text-[13px] text-muted">{p.category}</span>}
            </span>
            {p.reaction && (
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl ${p.reaction === "love" ? "bg-love-tint" : "bg-green-tint"}`} aria-hidden>
                {p.reaction === "love" ? "❤️" : "👍"}
              </span>
            )}
          </Link>
        ))}
      </div>

      <Link href="/" className="mt-auto flex h-[58px] items-center justify-center rounded-[20px] bg-green-deep text-[17px] font-semibold text-white">
        See who else your neighbors use
      </Link>
    </main>
  );
}
