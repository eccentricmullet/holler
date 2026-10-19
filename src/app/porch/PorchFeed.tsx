"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import ProLogo from "@/components/map/ProLogo";
import { aCategoryPro } from "@/lib/words";
import type { FeedItem } from "@/lib/porch";
import { HEADS_UP_TOPICS, KINDS, type PorchTab } from "@/lib/porch-kinds";
import { deletePostAction, markDoneAction, oneTapAction, reactAction, reportPostAction } from "./actions";

const REPORT_REASONS = ["Not neighborly", "Spam or ads", "Not true", "Shares private info"];

function prettyDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function PorchFeed({ items, tab }: { items: FeedItem[]; tab: PorchTab }) {
  if (items.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <span className="text-5xl" aria-hidden>
          🪴
        </span>
        <p className="mt-3 text-lg font-bold">Quiet on the porch</p>
        <p className="mt-1 text-[15px] text-muted">Be the first. A curb alert or a shout-out takes 30 seconds.</p>
        <Link href={`/porch/new${tab !== "all" ? `?tab=${tab}` : ""}`} className="mt-5 rounded-2xl bg-green-deep px-5 py-3 text-[15px] font-semibold text-white">
          Post something
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-5 flex flex-col gap-3">
      {items.map((item) => (item.type === "ask" ? <AskCard key={`ask-${item.id}`} item={item} /> : <PostCard key={item.id} item={item} />))}
    </div>
  );
}

const card = "rounded-[22px] bg-surface p-4 shadow-[0_6px_18px_rgba(26,29,36,0.08)]";

function AskCard({ item }: { item: Extract<FeedItem, { type: "ask" }> }) {
  return (
    <Link href={`/react?ask=${item.id}`} className={`${card} flex items-center gap-3.5 border-2 border-lime`}>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-green-tint text-2xl" aria-hidden>
        {item.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-green-deep">🔎 Need a pro</span>
        <span className="text-base font-bold">
          {item.who} needs {aCategoryPro(item.categoryName)}
        </span>
        <span className="text-[13px] text-muted">
          {item.when}
          {item.answers ? ` · ${item.answers} answered` : ""}
        </span>
      </span>
      <span className="shrink-0 rounded-xl bg-green-deep px-3 py-2 text-sm font-semibold text-white">I know one</span>
    </Link>
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

  return (
    <article className={`${card} ${done ? "opacity-60" : ""}`}>
      <header className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{item.initial}</span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[15px] font-bold">{item.who}</span>
          <span className="text-[13px] text-muted">
            {info.emoji} {info.label}
            {topic ? ` · ${topic.emoji} ${topic.label}` : ""} · {item.when}
          </span>
        </span>
        {done && info.doneLabel && (
          <span className="shrink-0 rounded-full bg-field px-2.5 py-1 text-xs font-semibold text-muted">{info.doneLabel} ✓</span>
        )}
        <button
          type="button"
          aria-label="More"
          onClick={() => setMenu(menu ? null : "report")}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-field"
        >
          ⋯
        </button>
      </header>

      {item.happensOn && <p className="mt-3 inline-block rounded-xl bg-green-tint px-3 py-1.5 text-sm font-semibold text-green-deep">📅 {prettyDate(item.happensOn)}</p>}
      <p className="mt-3 whitespace-pre-line text-[16px] leading-snug">{item.body}</p>
      {item.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoUrl} alt="" loading="lazy" className="mt-3 max-h-[360px] w-full rounded-2xl bg-field object-cover" />
      )}
      {item.pro && (
        <Link href={`/pro/${item.pro.id}`} className="mt-3 flex items-center gap-2.5 rounded-2xl bg-field p-2.5">
          <ProLogo name={item.pro.name} logoUrl={item.pro.logoUrl} color={item.pro.color} size={34} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{item.pro.name}</span>
          <span className="text-sm font-semibold text-green-deep">See pro ›</span>
        </Link>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={reaction === "thumbs_up"}
          onClick={() => react("thumbs_up")}
          className={`flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold ${
            reaction === "thumbs_up" ? "border-green-deep bg-green text-white" : "border-line"
          }`}
        >
          👍 {counts.thumbs || ""}
        </button>
        <button
          type="button"
          aria-pressed={reaction === "love"}
          onClick={() => react("love")}
          className={`flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold ${
            reaction === "love" ? "border-love bg-love text-white" : "border-line"
          }`}
        >
          ❤️ {counts.love || ""}
        </button>
        {info.action && !item.mine && !done && (
          <button
            type="button"
            aria-pressed={acted}
            onClick={() => {
              setActed(!acted);
              setActionCount((n) => n + (acted ? -1 : 1));
              startTransition(() => void oneTapAction(item.id, !acted));
            }}
            className={`flex h-9 items-center rounded-full border-2 px-3 text-sm font-semibold ${acted ? "border-green-deep bg-green text-white" : "border-line"}`}
          >
            {acted ? info.action.done : info.action.label}
          </button>
        )}
        {info.action && actionCount > 0 && (
          <span className="text-[13px] text-muted">
            {actionCount} {info.action.id === "seen_pet" ? (actionCount === 1 ? "neighbor has seen it" : "neighbors have seen it") : "going"}
          </span>
        )}
        {item.mine && info.doneLabel && !done && (
          <button
            type="button"
            onClick={() => {
              setDone(true);
              startTransition(() => void markDoneAction(item.id));
            }}
            className="ml-auto h-9 rounded-full bg-ink px-3.5 text-sm font-semibold text-white"
          >
            Mark {info.doneLabel.toLowerCase()}
          </button>
        )}
      </footer>

      {menu === "report" && (
        <div className="mt-3 rounded-2xl bg-field p-3">
          {item.mine ? (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Delete this post?")) return;
                setGone(true);
                startTransition(() => void deletePostAction(item.id));
              }}
              className="text-sm font-semibold text-love"
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
                    className="h-9 rounded-full border-2 border-line bg-surface px-3 text-sm font-semibold"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {menu === "reported" && <p className="mt-3 text-[13px] font-medium text-muted">Thanks. If a few neighbors flag it, it comes down on its own.</p>}
    </article>
  );
}
