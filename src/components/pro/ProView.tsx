import Link from "next/link";
import { SITE } from "@/config/site";
import type { ProPage } from "@/lib/pros";
import ProLogo from "@/components/map/ProLogo";
import ContactButton from "./ContactButton";
import ShareButton from "./ShareButton";
import SaveButton from "./SaveButton";

// The pro page content. Shown as a full page (direct link) or as a panel over the map.
export default function ProView({
  pro,
  backButton,
  inPanel = false,
  saved = false,
}: {
  pro: ProPage;
  backButton: React.ReactNode;
  inPanel?: boolean;
  saved?: boolean;
}) {
  const shortName = pro.name.split(" ")[0];

  return (
    <div className={`relative overflow-hidden bg-surface ${inPanel ? "min-h-full" : "mx-auto min-h-dvh max-w-md"}`}>
      {/* Green header with soft circles */}
      <div className="absolute inset-x-0 top-0 h-60 overflow-hidden bg-green" aria-hidden>
        <span className="absolute -left-[60px] top-[60px] size-[260px] rounded-full bg-lime opacity-55" />
        <span className="absolute -right-[70px] -top-[90px] size-[260px] rounded-full bg-green-deep opacity-60" />
        <span className="absolute right-[60px] top-[120px] size-[120px] rounded-full bg-lime-soft opacity-45" />
      </div>

      <div className="absolute inset-x-5 top-6 z-10 flex justify-between">
        {backButton}
        <div className="flex gap-2">
          <SaveButton proId={pro.id} initiallySaved={saved} />
          <ShareButton name={pro.name} proId={pro.id} />
        </div>
      </div>

      <div className={`relative mt-[196px] flex flex-col rounded-t-[32px] bg-surface px-6 ${inPanel ? "min-h-[calc(100%-196px)]" : "min-h-[calc(100dvh-196px)]"}`}>
        <div className="-mt-[38px]">
          <span className="inline-flex rounded-full shadow-[0_6px_16px_rgba(26,29,36,0.18)]">
            <ProLogo name={pro.name} logoUrl={pro.logoUrl} color={pro.color} size={76} />
          </span>
        </div>
        <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{pro.name}</h1>
        <span className="mt-1 text-[15px] text-muted">{[pro.categoryName, SITE.launchTownShort].filter(Boolean).join(" · ")}</span>

        <div className="mt-[30px] grid grid-cols-3 gap-3">
          <Tile emoji="👍" tint="bg-green-tint" value={pro.thumbs} label="Thumbs up" />
          <Tile emoji="❤️" tint="bg-love-tint" value={pro.love} label="Love them" />
          <Tile emoji="🏡" tint="bg-green-tint" value={pro.nearCustomers} label="Within 1 mi" />
        </div>

        {(pro.tagCounts.length > 0 || pro.price) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {pro.price && (
              <span className="flex h-9 items-center gap-1.5 rounded-full bg-field px-3.5 text-sm font-semibold">
                <span className="text-green-deep">{"$".repeat(pro.price.level)}</span>
                <span className="font-medium text-muted">
                  {["budget-friendly", "average price", "pricey"][pro.price.level - 1]}
                </span>
              </span>
            )}
            {pro.tagCounts.slice(0, 4).map((t) => (
              <span key={t.id} className="flex h-9 items-center gap-1.5 rounded-full bg-green-tint px-3.5 text-sm font-semibold">
                <span aria-hidden>{t.emoji}</span>
                {t.count} say {t.label.toLowerCase()}
              </span>
            ))}
          </div>
        )}

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
                    {n.byline} · {n.when}
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
              <ContactButton
                proId={pro.id}
                proName={pro.name}
                phone={pro.phone}
                from="pro_page"
                label={`Call or text ${shortName}`}
                className="flex-1"
              />
            ) : (
              <span className="flex h-14 flex-1 items-center justify-center rounded-[18px] bg-field text-[15px] text-muted">No phone number yet</span>
            )}
            <Link href={`/react?pro=${pro.id}`} aria-label={`React to ${shortName}`} className="flex size-14 items-center justify-center rounded-[18px] bg-green-tint text-2xl">
              👍
            </Link>
          </div>
          <Link href={`/flag?pro=${pro.id}`} className="mt-3 block text-center text-[13px] text-muted underline-offset-2 hover:underline">
            Had a bad experience?
          </Link>
        </div>
      </div>
    </div>
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
