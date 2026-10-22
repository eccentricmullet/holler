"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import ProLogo from "@/components/map/ProLogo";
import type { FeedItem } from "@/lib/porch";
import { TIMINGS } from "@/lib/ask-timing";
import { HEADS_UP_TOPICS, KINDS, type PorchTab } from "@/lib/porch-kinds";
import { deletePostAction, markDoneAction, oneTapAction, reactAction, reportPostAction } from "./actions";

const REPORT_REASONS = ["Not neighborly", "Spam or ads", "Not true", "Shares private info"];

const card = "flex flex-col gap-3 rounded-[18px] bg-surface p-4 shadow-card";
const chip = "inline-flex h-7 items-center gap-1 rounded-full px-[11px] text-xs";
const grayChip = `${chip} bg-field font-medium text-ink-soft`;
const btn = "flex h-11 items-center justify-center rounded-xl px-4 text-sm";

// Each person gets one of three soft avatar colors (from the mockups), the same every time
const AVATARS = ["bg-green-tint text-green-deep", "bg-warm-tint text-warm-ink", "bg-blue-tint text-blue-ink"];
function avatarClass(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

function prettyDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
// "07:00" -> "7am", "13:30" -> "1:30pm"
function prettyTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export default function PorchFeed({ items, tab, search }: { items: FeedItem[]; tab: PorchTab; search: string }) {
  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center rounded-[18px] bg-surface p-8 text-center shadow-card">
        <span className="text-5xl" aria-hidden>
          🪴
        </span>
        <p className="mt-3 text-lg font-bold">{search ? "Nothing matches that" : tab === "answered" ? "No answered requests yet" : "Quiet on the porch"}</p>
        <p className="mt-1 text-[15px] text-muted">
          {search ? "Try another word." : "Be the first. Ask for a pro or post a garage sale in under a minute."}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (item.type === "ask" ? <RequestCard key={`ask-${item.id}`} item={item} /> : <PostCard key={item.id} item={item} />))}
    </div>
  );
}

function Byline({ initials, who, meta, seed }: { initials: string; who: string; meta: string; seed: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass(seed)}`} aria-hidden>
        {initials}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[15px] font-semibold">{who}</span>
        <span className="truncate text-[13px] text-muted">{meta}</span>
      </span>
    </div>
  );
}

function RequestCard({ item }: { item: Extract<FeedItem, { type: "ask" }> }) {
  const timing =
    item.timing === "date" && item.neededOn ? prettyDate(item.neededOn) : (TIMINGS.find((t) => t.id === item.timing)?.label ?? null);
  const top = item.suggestions.slice(0, 2);
  const more = item.suggestions.length - 1;
  return (
    <article className={card}>
      <Byline initials={item.initials} who={item.mine ? "You" : item.who} meta={[item.hood, item.distance, item.when].filter(Boolean).join(" · ")} seed={item.who} />
      <div className="flex flex-wrap gap-1.5">
        <span className={`${chip} bg-neon font-bold text-on-neon`}>
          {item.icon} {item.categoryName}
        </span>
        {timing && <span className={grayChip}>{timing}</span>}
      </div>
      <p className="text-[15px] leading-[1.45]">{item.note || `Looking for a good ${item.categoryName.toLowerCase()} pro. Who do you use?`}</p>

      {item.chosen ? (
        <Link href={`/pro/${item.chosen.proId}`} className="flex items-center gap-2.5 rounded-xl bg-page px-3 py-2.5 text-[13px] text-ink-soft">
          ✅ <span>
            Went with <span className="font-semibold text-ink">{item.chosen.name}</span>
          </span>
        </Link>
      ) : (
        top.length > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl bg-page px-3 py-2.5">
            <span className="flex">
              {top.map((s, i) => (
                <span key={s.proId} className={`rounded-full ring-2 ring-page ${i ? "-ml-2" : ""}`}>
                  <ProLogo name={s.name} logoUrl={s.logoUrl} color={s.color} size={28} />
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
              <span className="font-semibold text-ink">{top[0].name}</span>
              {more > 0 ? ` + ${more} more` : ""} recommended
            </span>
          </div>
        )
      )}

      {item.open && (
        <div className="flex gap-2">
          {item.mine ? (
            <Link href={`/asks/${item.id}/found`} className={`${btn} flex-1 bg-neon font-bold text-on-neon`}>
              Found someone
            </Link>
          ) : item.answeredByMe ? (
            <span className={`${btn} flex-1 bg-field font-semibold text-ink-soft`}>You recommended ✓</span>
          ) : (
            <Link href={`/react?ask=${item.id}`} className={`${btn} flex-1 bg-neon font-bold text-on-neon`}>
              Recommend a pro
            </Link>
          )}
          {item.answers > 0 && (
            <Link href={item.mine ? "/asks" : `/react?ask=${item.id}`} className={`${btn} border border-line bg-surface font-medium`}>
              {item.answers} {item.answers === 1 ? "reply" : "replies"}
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

function PostCard({ item }: { item: Extract<FeedItem, { type: "post" }> }) {
  const info = KINDS[item.kind];
  const [reaction, setReaction] = useState(item.myReaction);
  const [counts, setCounts] = useState({ thumbs: item.thumbs, love: item.love });
  const [acted, setActed] = useState(item.myAction);
  const [actionCount, setActionCount] = useState(item.actionCount);
  const [done, setDone] = useState(item.done);
  const [gone, setGone] = useState(false);
  const [menu, setMenu] = useState<null | "report" | "reported">(null);
  const [, startTransition] = useTransition();
  const topic = HEADS_UP_TOPICS.find((t) => t.id === item.topic);
  const warm = item.kind === "garage_sale" || item.kind === "lost_pet" || item.kind === "found_pet";
  const when =
    item.happensOn &&
    [new Date(`${item.happensOn}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }), item.startsAt && item.endsAt && `${prettyTime(item.startsAt)}–${prettyTime(item.endsAt)}`]
      .filter(Boolean)
      .join(" · ");

  if (gone) return null;

  function react(r: "thumbs_up" | "love") {
    const next = reaction === r ? null : r;
    setCounts((c) => ({
      thumbs: c.thumbs + (next === "thumbs_up" ? 1 : 0) - (reaction === "thumbs_up" ? 1 : 0),
      love: c.love + (next === "love" ? 1 : 0) - (reaction === "love" ? 1 : 0),
    }));
    setReaction(next);
    startTransition(() => void reactAction(item.id, next));
  }

  const reactChip = (r: "thumbs_up" | "love", emoji: string, n: number) => (
    <button
      type="button"
      aria-pressed={reaction === r}
      aria-label={`${r === "love" ? "Love" : "Thumbs up"}${n ? `, ${n}` : ""}`}
      onClick={() => react(r)}
      className={`inline-flex h-11 items-center gap-1 rounded-full px-3 text-[13px] ${reaction === r ? "bg-neon font-bold text-on-neon" : "bg-field font-medium text-ink-soft"}`}
    >
      {emoji} {n || ""}
    </button>
  );

  return (
    <article className={`${card} ${done ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <Byline initials={item.initials} who={item.mine ? "You" : item.who} meta={[item.hood, item.distance, item.when].filter(Boolean).join(" · ")} seed={item.who} />
        <button
          type="button"
          aria-label="More"
          onClick={() => setMenu(menu ? null : "report")}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-lg text-muted hover:bg-field"
        >
          ⋯
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`${chip} font-semibold ${warm ? "bg-warm-tint text-warm-ink" : "bg-field text-ink-soft"}`}>
          {info.emoji} {info.label}
          {topic ? ` · ${topic.emoji} ${topic.label}` : ""}
        </span>
        {when && <span className={grayChip}>{when}</span>}
        {done && info.doneLabel && <span className={grayChip}>{info.doneLabel} ✓</span>}
      </div>

      <p className="whitespace-pre-line text-[15px] leading-[1.45]">{item.body}</p>
      {item.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoUrl} alt="" loading="lazy" className="max-h-[360px] w-full rounded-xl bg-field object-cover" />
      )}
      {item.pro && (
        <Link href={`/pro/${item.pro.id}`} className="flex items-center gap-2.5 rounded-xl bg-page p-2.5">
          <ProLogo name={item.pro.name} logoUrl={item.pro.logoUrl} color={item.pro.color} size={32} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{item.pro.name}</span>
          <span className="text-sm font-semibold text-green-deep">See pro ›</span>
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {reactChip("thumbs_up", "👍", counts.thumbs)}
        {reactChip("love", "❤️", counts.love)}
        {info.action && !item.mine && !done && (
          <button
            type="button"
            aria-pressed={acted}
            onClick={() => {
              setActed(!acted);
              setActionCount((n) => n + (acted ? -1 : 1));
              startTransition(() => void oneTapAction(item.id, !acted));
            }}
            className={`inline-flex h-11 items-center rounded-full px-3 text-[13px] ${acted ? "bg-neon font-bold text-on-neon" : "bg-field font-medium text-ink-soft"}`}
          >
            {acted ? info.action.done : info.action.label}
            {actionCount > 0 ? ` · ${actionCount}` : ""}
          </button>
        )}
        <span className="ml-auto flex gap-2">
          {item.address && !done && (
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(item.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} border border-line bg-surface font-medium`}
            >
              Get directions
            </a>
          )}
          {item.mine && info.doneLabel && !done && (
            <button
              type="button"
              onClick={() => {
                setDone(true);
                startTransition(() => void markDoneAction(item.id));
              }}
              className={`${btn} border border-line bg-surface font-medium`}
            >
              Mark {info.doneLabel.toLowerCase()}
            </button>
          )}
        </span>
      </div>

      {menu === "report" && (
        <div className="rounded-xl bg-page p-3">
          {item.mine ? (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Delete this post?")) return;
                setGone(true);
                startTransition(() => void deletePostAction(item.id));
              }}
              className="h-11 text-sm font-semibold text-love"
            >
              Delete my post
            </button>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-muted">Report this post (private)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setMenu("reported");
                      startTransition(async () => {
                        const res = await reportPostAction(item.id, r);
                        if (res.hidden) setGone(true);
                      });
                    }}
                    className="h-11 rounded-full border border-line bg-surface px-3 text-sm font-semibold"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {menu === "reported" && <p className="text-[13px] font-medium text-muted">Thanks. If a few neighbors flag it, it comes down on its own.</p>}
    </article>
  );
}
