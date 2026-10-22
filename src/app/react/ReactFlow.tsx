"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProLogo from "@/components/map/ProLogo";
import { shareInvite } from "@/components/InviteButton";
import GoogleAttribution from "@/components/GoogleAttribution";
import InstallCard from "@/components/InstallCard";
import { PRICES, TAGS } from "@/lib/tags";
import { MAX_CATEGORIES_PER_REACTION } from "@/lib/limits";
import { track } from "@/components/Track";
import { SITE } from "@/config/site";
import type { Category } from "@/components/map/types";
import type { SearchResult } from "@/app/api/pros/search/route";
import { previewBusiness, startingTags, submitReaction, type ProChoice, type ReactResult } from "./actions";
import type { BusinessPreview } from "@/lib/places";
import { answerAskAction } from "@/app/asks/actions";
import { cleanSocialUrl, socialKind, SOCIAL_LABEL } from "@/lib/social";

type Picked = { choice: ProChoice; name: string; logoUrl: string | null; counts?: { thumbs: number; love: number } };
type Step = "find" | "manual" | "confirm" | "react" | "done";

const NOTE_MAX = 140;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function formatPhone(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const ONBOARD_GOAL = 3;

// "lawn", but "HVAC" stays HVAC
function lowerName(n: string) {
  return n === n.toUpperCase() ? n : n.toLowerCase();
}

// "lawn", "lawn or gutters", "lawn, gutters or landscaping"
function orList(names: string[]) {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

export default function ReactFlow({
  categories,
  start,
  onboarding = false,
  presetCategory = null,
  answerTo = null,
}: {
  categories: Category[];
  start: { proId: string; name: string; logoUrl: string | null; category: string | null } | null;
  onboarding?: boolean; // just signed up: "Add 3 pros you use" (11e)
  presetCategory?: string | null; // from the seasonal banner (11g)
  answerTo?: { id: string; who: string } | null; // answering a neighbor's ask (11h)
}) {
  const [doneCount, setDoneCount] = useState(0);
  const router = useRouter();
  const [step, setStep] = useState<Step>(start ? "react" : "find");
  const [picked, setPicked] = useState<Picked | null>(
    start ? { choice: { kind: "holler", proId: start.proId }, name: start.name, logoUrl: start.logoUrl } : null
  );
  // The pro's service tags (lawn + gutters + landscaping); the first one leads.
  // Tags a pro already has are locked: neighbors can add more, not remove.
  const [cats, setCats] = useState<string[]>(() => {
    const first = start?.category ?? presetCategory;
    return first ? [first] : [];
  });
  const [locked, setLocked] = useState<string[]>([]);
  const category = cats[0] ?? null;
  const setCategory = (slug: string | null) => setCats(slug ? [slug] : []);
  const toggleCategory = (slug: string) =>
    setCats((cur) =>
      locked.includes(slug)
        ? cur
        : cur.includes(slug)
          ? cur.filter((x) => x !== slug)
          : [...cur, slug].slice(0, MAX_CATEGORIES_PER_REACTION)
    );
  // Coming straight to a pro on Holler (from its page): load its tags
  useEffect(() => {
    if (!start) return;
    startingTags({ kind: "holler", proId: start.proId }, start.name).then((t) => {
      setLocked(t.locked);
      if (t.tags.length) setCats((cur) => [...new Set([...t.tags, ...cur])]);
    });
  }, [start]);
  const [reaction, setReaction] = useState<"thumbs_up" | "love">("thumbs_up");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // "Is this them?" check after picking a business
  const [preview, setPreview] = useState<BusinessPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ReactResult, { ok: true }> | null>(null);

  // Search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());

  // Manual add
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualSocial, setManualSocial] = useState("");

  useEffect(() => {
    if (step !== "find" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/pros/search?q=${encodeURIComponent(query)}&session=${sessionToken}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        // typing again cancels the previous search
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, step, sessionToken]);

  // Picking a business first shows "Is this them?" so wrong picks get caught
  async function pick(p: Picked) {
    setPicked(p);
    setError(null);
    setReaction("thumbs_up");
    setNote("");
    setTags([]);
    setPrice(null);
    setCategory(null);
    setLocked([]);
    setPreview(null);
    setStep("confirm");
    if (p.choice.kind === "google") {
      setPreviewing(true);
      const r = await previewBusiness(p.choice.placeId, p.choice.sessionToken);
      setPreviewing(false);
      if (!r.ok) return setError(r.error);
      setPreview(r.preview);
      setCategory(presetCategory ?? r.suggestedCategory);
    } else {
      const t = await startingTags(p.choice, p.name);
      setLocked(t.locked);
      setCats([...new Set([...t.tags, ...(presetCategory ? [presetCategory] : [])])]);
    }
  }

  async function submit() {
    if (!picked) return;
    if (!category) return setError("Pick at least one thing they do.");
    setBusy(true);
    setError(null);
    const input = { pro: picked.choice, category, reaction, note, tags, price };
    const r = answerTo
      ? await answerAskAction(answerTo.id, input)
      : await submitReaction({ ...input, alsoCategories: cats.slice(1) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r);
    setDoneCount((n) => n + 1);
    track("reacted", { pro_id: r.proId, category, categories: answerTo ? 1 : cats.length, reaction, source: picked.choice.kind, with_note: note.trim().length > 0 });
    setStep("done");
    router.refresh();
  }

  function startOver() {
    setPicked(null);
    setResult(null);
    setQuery("");
    setResults([]);
    setManualName("");
    setManualPhone("");
    setManualSocial("");
    setSessionToken(crypto.randomUUID());
    setError(null);
    setStep("find");
  }


  const shortName = picked?.name.split(" ")[0] ?? "them";
  const currentCategory = categories.find((c) => c.slug === category);
  const presetName = (() => {
    const n = categories.find((c) => c.slug === presetCategory)?.name;
    return n ? lowerName(n) : null;
  })();

  // Keep the picked category visible in the long chip row
  useEffect(() => {
    if (step !== "react" || !category) return;
    document.querySelector(`[data-cat="${category}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [step, category]);

  // ---------- Done ----------
  if (step === "done" && result) {
    const love = result.reaction === "love";
    return (
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-page p-6 text-ink">

        <Link href="/" aria-label="Close" className="relative flex size-[46px] items-center justify-center self-end rounded-[14px] bg-surface shadow-card">
          <svg {...iconProps} width="22" height="22">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>

        <span
          className="relative mt-16 size-24 rounded-[18px] bg-surface text-center text-[52px] leading-[96px] shadow-card"
          role="img"
          aria-label={love ? "Love them" : "Thumbs up"}
        >
          {love ? "❤️" : "👍"}
        </span>
        <h1 className="relative mt-7 text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">
          {love ? `You love ${result.proName.split(" ")[0]}.` : `You gave ${result.proName.split(" ")[0]} a thumbs up.`}
        </h1>
        <p className="relative mt-3 text-[15px] leading-[1.45] text-muted">
          {answerTo ? `Sent to ${answerTo.who} Thanks for helping a neighbor. ` : ""}
          {result.neighbors > 1 ? `That makes ${result.neighbors} neighbors. ` : "You're the first neighbor to say so. "}
          The next person on your street looking for {orList(result.categoryNames.map(lowerName))} help will see it on the map.
        </p>
        {onboarding && (
          <p className="relative mt-5 text-[15px] font-semibold">
            {doneCount >= ONBOARD_GOAL
              ? "🎉 That's 3! Your neighbors' map just got better."
              : `${doneCount} of ${ONBOARD_GOAL} added`}
          </p>
        )}

        <InstallCard className="relative mt-6" />

        <div className="relative mt-auto flex flex-col gap-2.5 pt-6">
          {answerTo ? (
            <Link
              href="/asks"
              className="flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon"
            >
              See more neighbors asking
            </Link>
          ) : onboarding && doneCount >= ONBOARD_GOAL ? (
            <Link
              href="/"
              className="flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon"
            >
              See your map
            </Link>
          ) : (
            <button
              type="button"
              onClick={startOver}
              className="flex h-[54px] items-center justify-center rounded-[16px] bg-neon text-[16px] font-bold text-on-neon"
            >
              {onboarding ? `Add pro ${doneCount + 1} of ${ONBOARD_GOAL}` : "React to another pro"}
            </button>
          )}
          <button
            type="button"
            onClick={shareInvite}
            className="flex h-[54px] items-center justify-center rounded-[16px] border border-line bg-surface text-[16px] font-semibold"
          >
            📣 Invite a neighbor
          </button>
        </div>
      </main>
    );
  }

  // ---------- Is this them? ----------
  if (step === "confirm" && picked) {
    const kind = picked.choice.kind;
    const manual = picked.choice.kind === "manual" ? picked.choice : null;
    const website = preview?.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
    const waiting = kind === "google" && previewing;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setStep(kind === "manual" ? "manual" : "find")}
          className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink"
        >
          <svg {...iconProps} width="22" height="22">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 className="mt-8 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Is this them?</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">Make sure it&apos;s the right business so neighbors call the right people.</p>

        <div className="mt-6 rounded-[18px] bg-surface p-5 shadow-card">
          <div className="flex items-center gap-3.5">
            <ProLogo name={preview?.name ?? picked.name} logoUrl={picked.logoUrl} size={52} />
            <span className="min-w-0 text-xl font-bold leading-tight">{preview?.name ?? picked.name}</span>
          </div>
          {waiting && <div className="mt-4 h-16 animate-pulse rounded-2xl bg-field" aria-label="Loading details" />}
          {preview && (
            <dl className="mt-4 flex flex-col gap-2 text-[15px]">
              {preview.kind && (
                <div className="flex gap-2">
                  <dt aria-label="Kind of business">🏷️</dt>
                  <dd>{preview.kind}</dd>
                </div>
              )}
              {preview.address && (
                <div className="flex gap-2">
                  <dt aria-label="Address">📍</dt>
                  <dd>{preview.address}</dd>
                </div>
              )}
              {preview.phone && (
                <div className="flex gap-2">
                  <dt aria-label="Phone">📞</dt>
                  <dd>{preview.phone}</dd>
                </div>
              )}
              {website && (
                <div className="flex gap-2">
                  <dt aria-label="Website">🌐</dt>
                  <dd className="truncate">{website}</dd>
                </div>
              )}
            </dl>
          )}
          {kind === "holler" && (
            <p className="mt-4 text-[15px] text-muted">
              Already on {SITE.name}
              {picked.counts && (picked.counts.thumbs || picked.counts.love) ? ` · 👍 ${picked.counts.thumbs} · ❤️ ${picked.counts.love}` : ""}
            </p>
          )}
          {manual && (
            <dl className="mt-4 flex flex-col gap-2 text-[15px]">
              {manual.phone && (
                <div className="flex gap-2">
                  <dt aria-label="Phone">📞</dt>
                  <dd>{formatPhone(manual.phone.replace(/\D/g, "").slice(-10))}</dd>
                </div>
              )}
              {manual.social && (
                <div className="flex gap-2">
                  <dt aria-label={SOCIAL_LABEL[socialKind(manual.social) ?? "instagram"]}>{socialKind(manual.social) === "facebook" ? "📘" : "📸"}</dt>
                  <dd className="truncate">{manual.social.replace(/^https:\/\/(www\.)?/, "")}</dd>
                </div>
              )}
            </dl>
          )}
          {preview && <GoogleAttribution className="mt-4" />}
        </div>

        {preview?.notAService && (
          <p role="alert" className="mt-4 rounded-[18px] bg-love-tint p-4 text-[15px] leading-snug">
            <span className="font-semibold">Heads up:</span> Google lists this as {preview.kind ? `${/^[aeiou]/i.test(preview.kind) ? "an" : "a"} ${preview.kind.toLowerCase()}` : "a business that isn't a home-service pro"}. Are you sure
            they did work for you?
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-[15px] font-medium text-love">
            {error}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-6">
          <button
            type="button"
            disabled={waiting || (kind === "google" && !preview)}
            onClick={() => setStep("react")}
            className="h-[54px] rounded-[16px] bg-neon text-[17px] font-semibold text-on-neon disabled:opacity-40"
          >
            Yes, that&apos;s them
          </button>
          <button
            type="button"
            onClick={() => setStep(kind === "manual" ? "manual" : "find")}
            className="h-[54px] rounded-[16px] bg-field text-[17px] font-semibold text-ink"
          >
            No, pick again
          </button>
        </div>
      </main>
    );
  }

  // ---------- React ----------
  if (step === "react" && picked) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Back"
            onClick={() => (start && picked.choice.kind === "holler" && picked.choice.proId === start.proId ? router.back() : startOver())}
            className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink"
          >
            <svg {...iconProps} width="22" height="22">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <span className="flex h-10 max-w-[70%] items-center gap-2 rounded-full bg-field py-0 pl-1.5 pr-3.5 text-sm font-semibold">
            <ProLogo name={picked.name} logoUrl={picked.logoUrl} size={28} />
            <span className="truncate">{picked.name}</span>
          </span>
        </div>

        <h1 className="mt-9 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">How was {shortName}?</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">One tap. Your neighbors see it on the map.</p>

        {answerTo && currentCategory ? (
          <p className="mt-5 text-[15px]">
            <span className="font-semibold">For {answerTo.who}&apos;s ask:</span> {currentCategory.icon} {currentCategory.name}
          </p>
        ) : (
        <div className="mt-5">
          <span className="text-[15px] font-semibold">
            {locked.length ? "What they do" : "What do they do?"}{" "}
            <span className="font-normal text-muted">{locked.length ? "tap to add more" : "pick all that apply"}</span>
          </span>
          <div className="no-scrollbar -mx-6 mt-2 flex gap-2 overflow-x-auto px-6">
            {[...categories].sort((a, b) => Number(locked.includes(b.slug)) - Number(locked.includes(a.slug))).map((c) => (
              <button
                key={c.slug}
                data-cat={c.slug}
                type="button"
                aria-pressed={cats.includes(c.slug)}
                aria-disabled={locked.includes(c.slug) || undefined}
                onClick={() => toggleCategory(c.slug)}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${
                  cats.includes(c.slug) ? "border-neon bg-neon text-on-neon" : "border-line bg-surface"
                }`}
              >
                <span aria-hidden>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>
        )}

        <div className="mt-6 flex flex-col gap-3.5">
          <ReactionChoice
            selected={reaction === "thumbs_up"}
            onClick={() => setReaction("thumbs_up")}
            emoji="👍"
            title="Thumbs up"
            body="Good work. I'd hire them again."
            selectedClass="border-neon bg-green-tint"
            tileClass="bg-neon"
          />
          <ReactionChoice
            selected={reaction === "love"}
            onClick={() => setReaction("love")}
            emoji="❤️"
            title="Love them"
            body="Awesome. I tell everyone about them."
            selectedClass="border-love bg-love-tint"
            tileClass="bg-love"
          />
        </div>

        <span className="mt-6 text-[15px] font-semibold">
          What stood out? <span className="font-normal text-muted">optional</span>
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = tags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== t.id) : [...cur, t.id]))}
                className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                  on ? "border-neon bg-neon text-on-neon" : "border-line bg-surface text-ink"
                }`}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        <span className="mt-5 text-[15px] font-semibold">
          Price <span className="font-normal text-muted">optional</span>
        </span>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Price">
          {PRICES.map((p) => {
            const on = price === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPrice(on ? null : p.value)}
                className={`flex h-14 flex-col items-center justify-center rounded-2xl border transition-colors ${
                  on ? "border-neon bg-neon text-on-neon" : "border-line bg-surface text-ink"
                }`}
              >
                <span className="text-base font-bold leading-none">{p.label}</span>
                <span className={`mt-1 text-xs ${on ? "text-on-neon" : "text-muted"}`}>{p.hint}</span>
              </button>
            );
          })}
        </div>

        <label htmlFor="react-note" className="mt-6 text-[15px] font-semibold">
          Add a quick note <span className="font-normal text-muted">optional</span>
        </label>
        <textarea
          id="react-note"
          rows={2}
          maxLength={NOTE_MAX}
          placeholder="What made them good?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-2 resize-none rounded-[16px] border border-line bg-surface px-4 py-3.5 text-base text-ink outline-none placeholder:text-muted"
        />
        <span className="mt-1 self-end text-[13px] text-muted">
          {note.length}/{NOTE_MAX}
        </span>

        {error && (
          <p role="alert" className="mt-2 text-[15px] font-medium text-love">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-auto h-[54px] rounded-[16px] bg-neon text-[17px] font-semibold text-on-neon disabled:opacity-60"
        >
          {busy ? "One sec…" : currentCategory ? "Put it on the map" : "Pick what they do for you"}
        </button>
      </main>
    );
  }

  // ---------- Manual add ----------
  if (step === "manual") {
    const phoneDigits = manualPhone.replace(/\D/g, "");
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
        <button
          type="button"
          aria-label="Back"
          onClick={() => setStep("find")}
          className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink"
        >
          <svg {...iconProps} width="22" height="22">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 className="mt-8 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">Add a pro</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">Their name, plus a phone number or their Instagram or Facebook. Neighbors reach them from the map.</p>

        <label htmlFor="m-name" className="mb-2 mt-6 text-[15px] font-semibold">
          Business name
        </label>
        <input
          id="m-name"
          value={manualName}
          maxLength={80}
          onChange={(e) => setManualName(e.target.value)}
          autoFocus
          placeholder="Joe's Mowing"
          className="h-14 rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted"
        />
        <label htmlFor="m-phone" className="mb-2 mt-5 text-[15px] font-semibold">
          Phone number
        </label>
        <input
          id="m-phone"
          type="tel"
          inputMode="tel"
          value={formatPhone(phoneDigits.length === 11 && phoneDigits.startsWith("1") ? phoneDigits.slice(1) : phoneDigits)}
          onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="(615) 555-0123"
          className="h-14 rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted"
        />
        <div className="mt-4 flex items-center gap-3 text-[13px] font-semibold text-muted" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          or, no phone?
          <span className="h-px flex-1 bg-line" />
        </div>
        <label htmlFor="m-social" className="mb-2 mt-3 text-[15px] font-semibold">
          Instagram or Facebook
        </label>
        <input
          id="m-social"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          value={manualSocial}
          maxLength={200}
          onChange={(e) => setManualSocial(e.target.value)}
          placeholder="@joesmowing or facebook.com/joesmowing"
          className="h-14 rounded-[16px] border border-line bg-surface px-4 text-base outline-none placeholder:text-muted"
        />

        {error && (
          <p role="alert" className="mt-4 text-[15px] font-medium text-love">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            if (manualName.trim().length < 2) return setError("Add the business name.");
            const d = phoneDigits.length === 11 && phoneDigits.startsWith("1") ? phoneDigits.slice(1) : phoneDigits;
            if (d && d.length !== 10) return setError("Check their phone number: it needs 10 digits.");
            const social = manualSocial.trim() ? cleanSocialUrl(manualSocial) : null;
            if (manualSocial.trim() && !social) return setError("That doesn't look like an Instagram or Facebook link. Try @name or paste their page link.");
            if (!d && !social) return setError("Add their phone number, or their Instagram or Facebook.");
            pick({ choice: { kind: "manual", name: manualName, phone: d, social: social ?? undefined }, name: manualName.trim(), logoUrl: null });
          }}
          className="mt-auto h-[54px] rounded-[16px] bg-neon text-[17px] font-semibold text-on-neon"
        >
          Next
        </button>
      </main>
    );
  }

  // ---------- Find ----------
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Close" className="flex size-11 items-center justify-center rounded-full bg-surface shadow-card text-ink">
          <svg {...iconProps} width="22" height="22">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        {onboarding && (
          <Link href="/" className="text-[15px] font-semibold text-muted">
            Skip for now
          </Link>
        )}
      </div>

      {onboarding ? (
        <>
          <div className="mt-6 flex gap-1.5" aria-label={`${doneCount} of ${ONBOARD_GOAL} added`}>
            {Array.from({ length: ONBOARD_GOAL }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < doneCount ? "bg-neon" : "bg-line"}`} />
            ))}
          </div>
          <h1 className="mt-6 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">
            Add {ONBOARD_GOAL - doneCount === ONBOARD_GOAL ? "3 pros" : `${ONBOARD_GOAL - doneCount} more`} you use
          </h1>
          <p className="mt-2.5 text-base leading-snug text-muted">
            Your lawn guy, your plumber, whoever you&apos;d tell a neighbor about. It takes about a minute.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-8 text-[28px] font-bold leading-[1.1] tracking-[-0.02em]">
            {answerTo ? (
              <>Who would you recommend to {answerTo.who}?</>
            ) : presetName ? (
              <>Who do you use for {presetName}?</>
            ) : (
              <>
                Who do you
                <br />
                use and trust?
              </>
            )}
          </h1>
          <p className="mt-2.5 text-base leading-snug text-muted">Only good word goes on the map.</p>
        </>
      )}

      <label htmlFor="find-pro" className="sr-only">
        Business name
      </label>
      <div className="mt-6 flex h-14 items-center gap-2.5 rounded-[18px] border border-neon bg-surface px-4">
        <svg {...iconProps} width="20" height="20" className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="find-pro"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          autoComplete="off"
          placeholder="Business name"
          className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {results.map((r) => (
          <button
            key={r.kind === "holler" ? r.proId : r.placeId}
            type="button"
            onClick={() =>
              pick(
                r.kind === "holler"
                  ? { choice: { kind: "holler", proId: r.proId }, name: r.name, logoUrl: r.logoUrl, counts: { thumbs: r.thumbs, love: r.love } }
                  : { choice: { kind: "google", placeId: r.placeId, sessionToken }, name: r.name, logoUrl: null }
              )
            }
            className="flex items-center gap-3.5 rounded-[18px] bg-surface p-3.5 text-left shadow-card"
          >
            <ProLogo name={r.name} logoUrl={r.kind === "holler" ? r.logoUrl : null} size={48} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[17px] font-bold">{r.name}</span>
              <span className="truncate text-sm text-muted">
                {r.kind === "holler"
                  ? [r.tagLine, r.thumbs && `👍 ${r.thumbs}`, r.love && `❤️ ${r.love}`].filter(Boolean).join(" · ") || `On ${SITE.name}`
                  : [`New to ${SITE.name}`, r.area].filter(Boolean).join(" · ")}
              </span>
            </span>
            <svg {...iconProps} width="20" height="20" className="shrink-0 text-muted">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="px-1 text-[15px] text-muted">No matches yet. Add them below.</p>
        )}
        {results.some((r) => r.kind === "google") && <GoogleAttribution className="mt-1 self-end px-1" />}
      </div>

      <button
        type="button"
        onClick={() => {
          setManualName(query.trim());
          setError(null);
          setStep("manual");
        }}
        className="mt-auto flex items-center gap-3.5 rounded-[18px] border border-dashed border-line bg-surface p-[18px] text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-green-tint text-green-deep">
          <svg {...iconProps} width="22" height="22" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-bold">Not listed?</span>
          <span className="text-sm text-muted">Add them with a phone number, Instagram or Facebook</span>
        </span>
      </button>
    </main>
  );
}

// Selected: tinted card, strong border, solid colored tile and a check.
// Not selected: plain card, gray tile, faded emoji.
function ReactionChoice(props: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  body: string;
  selectedClass: string;
  tileClass: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
      className={`relative flex items-center gap-4 rounded-3xl border p-[18px] text-left transition-colors ${
        props.selected ? props.selectedClass : "border-line bg-surface"
      }`}
    >
      <span
        className={`size-16 shrink-0 rounded-[18px] text-center text-[28px] leading-[64px] transition-all ${
          props.selected ? props.tileClass : "bg-field opacity-60 grayscale"
        }`}
        aria-hidden
      >
        {props.emoji}
      </span>
      <span className="flex flex-col gap-[3px]">
        <span className="text-[19px] font-bold">{props.title}</span>
        <span className="text-sm text-muted">{props.body}</span>
      </span>
      {props.selected && (
        <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-neon text-[13px] font-bold text-on-neon" aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}
