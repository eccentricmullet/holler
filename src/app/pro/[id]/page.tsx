import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { getProPage, viewerCenter } from "@/lib/pros";
import ProLogo from "@/components/map/ProLogo";
import ShareButton from "./ShareButton";

type Params = { params: Promise<{ id: string }> };

// Link preview text when the page is texted or shared
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const result = await getProPage(id, SITE.launchCenter);
  if (result.kind !== "found") return { title: SITE.name };
  const { pro } = result;
  const title = pro.categoryName ? `${pro.name} · ${pro.categoryName}` : pro.name;
  const description = `👍 ${pro.thumbs} · ❤️ ${pro.love} from ${SITE.launchTownShort} neighbors on ${SITE.name}`;
  return {
    title: `${title} · ${SITE.name}`,
    description,
    openGraph: { title, description, siteName: SITE.name, type: "website", url: `/pro/${pro.id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);

export default async function ProPageRoute({ params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const near = await viewerCenter(supabase, SITE.launchCenter);
  const result = await getProPage(id, near);
  if (result.kind === "merged") permanentRedirect(`/pro/${result.into}`);
  if (result.kind === "missing") notFound();
  const { pro } = result;
  const shortName = pro.name.split(" ")[0];

  return (
    <main className="relative mx-auto min-h-dvh max-w-md overflow-hidden bg-surface">
      {/* Green header with soft circles */}
      <div className="absolute inset-x-0 top-0 h-60 overflow-hidden bg-green" aria-hidden>
        <span className="absolute -left-[60px] top-[60px] size-[260px] rounded-full bg-lime opacity-55" />
        <span className="absolute -right-[70px] -top-[90px] size-[260px] rounded-full bg-green-deep opacity-60" />
        <span className="absolute right-[60px] top-[120px] size-[120px] rounded-full bg-lime-soft opacity-45" />
      </div>

      <div className="absolute inset-x-5 top-6 z-10 flex justify-between">
        <Link href="/" aria-label="Back to map" className="flex size-[46px] items-center justify-center rounded-2xl bg-surface text-ink">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <ShareButton name={pro.name} />
      </div>

      <div className="relative mt-[196px] flex min-h-[calc(100dvh-196px)] flex-col rounded-t-[32px] bg-surface px-6">
        <div className="-mt-[38px]">
          <span className="inline-flex rounded-full shadow-[0_6px_16px_rgba(26,29,36,0.18)]">
            <ProLogo name={pro.name} logoUrl={pro.logoUrl} size={76} />
          </span>
        </div>
        <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{pro.name}</h1>
        <span className="mt-1 text-[15px] text-muted">
          {[pro.categoryName, SITE.launchTownShort].filter(Boolean).join(" · ")}
        </span>

        <div className="mt-[30px] grid grid-cols-3 gap-3">
          <Tile emoji="👍" tint="bg-green-tint" value={pro.thumbs} label="Thumbs up" />
          <Tile emoji="❤️" tint="bg-love-tint" value={pro.love} label="Love them" />
          <Tile emoji="🏡" tint="bg-green-tint" value={pro.nearCustomers} label="Within 1 mi" />
        </div>

        <h2 className="mb-2 mt-[26px] text-[19px] font-bold">What neighbors say</h2>
        {pro.notes.length === 0 ? (
          <p className="py-3 text-[15px] text-muted">No notes yet. Be the first to say something nice.</p>
        ) : (
          <ul className="flex flex-col">
            {pro.notes.map((n) => (
              <li key={n.vouchId} className="flex gap-3 border-b border-line py-3 last:border-b-0">
                <span className="text-[22px] leading-[1.2]" role="img" aria-label={n.reaction === "love" ? "Loves them" : "Thumbs up"}>
                  {n.reaction === "love" ? "❤️" : "👍"}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[15px] leading-snug">&ldquo;{n.note}&rdquo;</span>
                  <span className="flex gap-2 text-[13px] font-medium text-muted">
                    {n.byline}
                    <Link href={`/flag?note=${n.vouchId}`} className="font-normal underline-offset-2 hover:underline">
                      · Report
                    </Link>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="sticky bottom-0 mt-auto bg-surface pb-4 pt-3">
          <div className="flex gap-2.5">
            {pro.phone ? (
              <a
                href={`tel:${pro.phone}`}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] bg-green-deep text-[17px] font-semibold text-white"
              >
                <PhoneIcon />
                Call {shortName}
              </a>
            ) : (
              <span className="flex h-14 flex-1 items-center justify-center rounded-[18px] bg-field text-[15px] text-muted">
                No phone number yet
              </span>
            )}
            {pro.phone && (
              <a
                href={`sms:${pro.phone}`}
                aria-label={`Text ${shortName}`}
                className="flex size-14 items-center justify-center rounded-[18px] bg-field text-ink"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                </svg>
              </a>
            )}
            <Link
              href={`/react?pro=${pro.id}`}
              aria-label={`React to ${shortName}`}
              className="flex size-14 items-center justify-center rounded-[18px] bg-green-tint text-2xl"
            >
              👍
            </Link>
          </div>
          <Link href={`/flag?pro=${pro.id}`} className="mt-3 block text-center text-[13px] text-muted underline-offset-2 hover:underline">
            Had a bad experience?
          </Link>
        </div>
      </div>
    </main>
  );
}

function Tile({ emoji, tint, value, label }: { emoji: string; tint: string; value: number; label: string }) {
  return (
    <div className="relative flex flex-col items-center rounded-[20px] border-2 border-lime px-2 pb-3 pt-[26px]">
      <span className={`absolute -top-5 size-10 rounded-[14px] text-center text-xl leading-10 ${tint}`} aria-hidden>
        {emoji}
      </span>
      <span className="text-[30px] font-bold leading-none">{value}</span>
      <span className="mt-1 text-[13px] text-muted">{label}</span>
    </div>
  );
}
