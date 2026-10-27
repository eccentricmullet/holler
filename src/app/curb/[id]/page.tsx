import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { curbItem } from "@/lib/curb";
import { CURB_KINDS } from "@/lib/curb-kinds";
import { GoneButton, InterestButton, PhotoSwiper, ReportLink } from "./ItemParts";

export const metadata: Metadata = { title: `The Curb · ${SITE.name}` };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const card = "rounded-[18px] bg-surface p-4 shadow-card";

export default async function CurbItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/curb/${id}`)}`);
  const item = await curbItem(createAdminClient(), user.id, id);
  if (!item) notFound();

  const kind = CURB_KINDS.find((k) => k.id === item.kind);
  const ended = item.gone || item.expired;
  const sellerFirst = item.who.split(" ")[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <div className="relative">
        <PhotoSwiper urls={item.photoUrls} title={item.title} />
        <Link href="/curb" aria-label="Back to the Curb" className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-control">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        {item.price === 0 && !ended && (
          <span className="absolute bottom-4 left-4 flex h-[30px] items-center rounded-full bg-neon px-3 text-[13px] font-bold text-on-neon">📣 Curb alert</span>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {ended && (
          <p className="rounded-[14px] bg-field px-4 py-3 text-[15px] font-semibold text-ink-soft">
            {item.gone ? "This one's gone." : "This listing ended."}
          </p>
        )}

        <div className="px-1">
          <p className="text-[26px] font-bold leading-tight tracking-[-0.02em]">{item.priceLabel}</p>
          <h1 className="mt-1 text-[20px] font-semibold leading-snug">{item.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[kind && `${kind.emoji} ${kind.label}`, item.mine ? "Your listing" : [item.hood, item.distance].filter(Boolean).join(" · "), item.when]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {item.note && <p className="mt-3 whitespace-pre-line text-[15px] leading-snug">{item.note}</p>}
        </div>

        {!item.mine && (
          <div className={`${card} flex items-center gap-3`}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-tint text-[15px] font-bold text-green-deep">{item.initials}</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-semibold">{item.who}</span>
              <span className="truncate text-[13px] text-muted">{item.hood ? `Neighbor in ${item.hood}` : "Verified neighbor"}</span>
            </span>
          </div>
        )}

        {!item.mine && !ended && <InterestButton itemId={item.id} initial={item.iAmInterested} seller={sellerFirst} />}

        {item.mine && (
          <section className={card} aria-label="Who's interested">
            <h2 className="text-[17px] font-bold">
              {item.interested.length ? `${item.interested.length} interested` : "No one's interested yet"}
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-muted">
              {item.interested.length
                ? "They shared their number with you. Text whoever you'd like, first come or your pick."
                : ended
                  ? "This listing is off the Curb."
                  : "When a neighbor taps “I'm interested,” you'll see them here (and get an alert if alerts are on)."}
            </p>
            {item.interested.length > 0 && (
              <ul className="mt-3 flex flex-col">
                {item.interested.map((p) => (
                  <li key={p.id} className="flex min-h-14 items-center gap-3 border-t border-line py-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{p.who}</span>
                      <span className="text-[13px] text-muted">{p.when}</span>
                    </span>
                    {p.phone ? (
                      <a
                        href={`sms:${p.phone}?&body=${encodeURIComponent(`Hi ${p.who.split(" ")[0]}! It's ${sellerFirst} from ${SITE.name}, about the ${item.title}.`)}`}
                        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-neon px-4 text-sm font-bold text-on-neon"
                      >
                        💬 Text
                      </a>
                    ) : (
                      <span className="shrink-0 text-[13px] text-muted">No number on file</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {item.mine && !ended && <GoneButton itemId={item.id} />}
        {!item.mine && !ended && <ReportLink itemId={item.id} />}
      </div>
    </main>
  );
}
