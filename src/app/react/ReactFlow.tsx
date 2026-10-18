"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProLogo from "@/components/map/ProLogo";
import { shareInvite } from "@/components/InviteButton";
import { track } from "@/components/Track";
import { SITE } from "@/config/site";
import type { Category } from "@/components/map/types";
import type { SearchResult } from "@/app/api/pros/search/route";
import { submitReaction, suggestCategory, type ProChoice, type ReactResult } from "./actions";

type Picked = { choice: ProChoice; name: string; logoUrl: string | null };
type Step = "find" | "manual" | "react" | "done";

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

export default function ReactFlow({
  categories,
  start,
}: {
  categories: Category[];
  start: { proId: string; name: string; logoUrl: string | null; category: string | null } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(start ? "react" : "find");
  const [picked, setPicked] = useState<Picked | null>(
    start ? { choice: { kind: "holler", proId: start.proId }, name: start.name, logoUrl: start.logoUrl } : null
  );
  const [category, setCategory] = useState<string | null>(start?.category ?? null);
  const [reaction, setReaction] = useState<"thumbs_up" | "love">("thumbs_up");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
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

  async function pick(p: Picked) {
    setPicked(p);
    setError(null);
    setReaction("thumbs_up");
    setNote("");
    setCategory(null);
    setStep("react");
    setCategory(await suggestCategory(p.choice, p.name));
  }

  async function submit() {
    if (!picked) return;
    if (!category) return setError("Pick what they do for you.");
    setBusy(true);
    setError(null);
    const r = await submitReaction({ pro: picked.choice, category, reaction, note });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setResult(r);
    track("reacted", { pro_id: r.proId, category, reaction, source: picked.choice.kind, with_note: note.trim().length > 0 });
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
    setSessionToken(crypto.randomUUID());
    setError(null);
    setStep("find");
  }


  const shortName = picked?.name.split(" ")[0] ?? "them";
  const currentCategory = categories.find((c) => c.slug === category);

  // ---------- Done ----------
  if (step === "done" && result) {
    const love = result.reaction === "love";
    return (
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden bg-green-deep p-6 text-white">
        <span className="absolute -right-[90px] -top-20 size-[300px] rounded-full bg-green" aria-hidden />
        <span className="absolute -left-[120px] top-[260px] size-[280px] rounded-full bg-green opacity-50" aria-hidden />
        <span className="absolute right-10 top-[150px] size-[110px] rounded-full bg-lime opacity-50" aria-hidden />

        <Link href="/" aria-label="Close" className="relative flex size-[46px] items-center justify-center self-end rounded-2xl bg-white/20">
          <svg {...iconProps} width="22" height="22">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>

        <span
          className="relative mt-[90px] size-24 rounded-[32px] bg-white text-center text-[52px] leading-[96px] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
          role="img"
          aria-label={love ? "Love them" : "Thumbs up"}
        >
          {love ? "❤️" : "👍"}
        </span>
        <h1 className="relative mt-7 text-[38px] font-extrabold leading-[1.08] tracking-[-0.02em]">
          {love ? `You love ${result.proName.split(" ")[0]}.` : `You gave ${result.proName.split(" ")[0]} a thumbs up.`}
        </h1>
        <p className="relative mt-3.5 text-[17px] leading-[1.45] text-green-tint">
          {result.neighbors > 1 ? `That makes ${result.neighbors} neighbors. ` : "You're the first neighbor to say so. "}
          The next person on your street looking for {result.categoryName.toLowerCase()} help will see it on the map.
        </p>

        <div className="relative mt-auto flex flex-col gap-2.5">
          <button
            type="button"
            onClick={startOver}
            className="flex h-[58px] items-center justify-center rounded-[20px] bg-white text-[17px] font-bold text-green-deep"
          >
            React to another pro
          </button>
          <button
            type="button"
            onClick={shareInvite}
            className="flex h-[58px] items-center justify-center rounded-[20px] border-2 border-white/50 text-[17px] font-semibold"
          >
            📣 Invite a neighbor
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
            className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink"
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

        <h1 className="mt-9 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">How was {shortName}?</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">One tap. Your neighbors see it on the map.</p>

        <div className="mt-5">
          <span className="text-[15px] font-semibold">They do my</span>
          <div className="no-scrollbar -mx-6 mt-2 flex gap-2 overflow-x-auto px-6">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={c.slug === category}
                onClick={() => setCategory(c.slug)}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold ${
                  c.slug === category ? "border-green bg-green-wash" : "border-line bg-surface"
                }`}
              >
                <span aria-hidden>{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3.5">
          <ReactionChoice
            selected={reaction === "thumbs_up"}
            onClick={() => setReaction("thumbs_up")}
            emoji="👍"
            title="Thumbs up"
            body="Good work. I'd hire them again."
            selectedClass="border-green bg-green-wash"
            tileClass="bg-green-wash"
          />
          <ReactionChoice
            selected={reaction === "love"}
            onClick={() => setReaction("love")}
            emoji="❤️"
            title="Love them"
            body="Awesome. I tell everyone about them."
            selectedClass="border-love bg-love-tint"
            tileClass="bg-love-tint"
          />
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
          className="mt-2 resize-none rounded-[18px] bg-field px-4 py-3.5 text-base text-ink outline-none placeholder:text-muted"
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
          className="mt-auto h-[58px] rounded-[20px] bg-green-deep text-[17px] font-semibold text-white disabled:opacity-60"
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
          className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink"
        >
          <svg {...iconProps} width="22" height="22">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">Add a pro</h1>
        <p className="mt-2.5 text-base leading-snug text-muted">Just their name and number. Neighbors can call them from the map.</p>

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
          className="h-14 rounded-[18px] bg-field px-4 text-base outline-none placeholder:text-muted"
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
          className="h-14 rounded-[18px] bg-field px-4 text-base outline-none placeholder:text-muted"
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
            if (d.length !== 10) return setError("Add their 10-digit phone number.");
            pick({ choice: { kind: "manual", name: manualName, phone: d }, name: manualName.trim(), logoUrl: null });
          }}
          className="mt-auto h-[58px] rounded-[20px] bg-green-deep text-[17px] font-semibold text-white"
        >
          Next
        </button>
      </main>
    );
  }

  // ---------- Find ----------
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col p-6">
      <Link href="/" aria-label="Close" className="flex size-[46px] items-center justify-center rounded-2xl bg-field text-ink">
        <svg {...iconProps} width="22" height="22">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>

      <h1 className="mt-8 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
        Who do you
        <br />
        use and trust?
      </h1>
      <p className="mt-2.5 text-base leading-snug text-muted">Only good word goes on the map.</p>

      <label htmlFor="find-pro" className="sr-only">
        Business name
      </label>
      <div className="mt-6 flex h-14 items-center gap-2.5 rounded-[18px] border-2 border-green bg-field px-4">
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
                  ? { choice: { kind: "holler", proId: r.proId }, name: r.name, logoUrl: r.logoUrl }
                  : { choice: { kind: "google", placeId: r.placeId, sessionToken }, name: r.name, logoUrl: null }
              )
            }
            className="flex items-center gap-3.5 rounded-[20px] bg-surface p-3.5 text-left shadow-[0_6px_18px_rgba(26,29,36,0.08)]"
          >
            <ProLogo name={r.name} logoUrl={r.kind === "holler" ? r.logoUrl : null} size={48} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[17px] font-bold">{r.name}</span>
              <span className="truncate text-sm text-muted">
                {r.kind === "holler"
                  ? [r.thumbs && `👍 ${r.thumbs}`, r.love && `❤️ ${r.love}`].filter(Boolean).join(" · ") || `On ${SITE.name}`
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
      </div>

      <button
        type="button"
        onClick={() => {
          setManualName(query.trim());
          setError(null);
          setStep("manual");
        }}
        className="mt-auto flex items-center gap-3.5 rounded-[22px] border-2 border-dashed border-lime p-[18px] text-left"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-green-tint text-green-deep">
          <svg {...iconProps} width="22" height="22" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-bold">Not listed?</span>
          <span className="text-sm text-muted">Add them with a name and phone number</span>
        </span>
      </button>
    </main>
  );
}

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
      className={`flex items-center gap-4 rounded-3xl border-[2.5px] p-[18px] text-left ${
        props.selected ? props.selectedClass : "border-line bg-surface"
      }`}
    >
      <span
        className={`size-16 shrink-0 rounded-[20px] text-center text-[34px] leading-[64px] ${props.selected ? "bg-white" : props.tileClass}`}
        aria-hidden
      >
        {props.emoji}
      </span>
      <span className="flex flex-col gap-[3px]">
        <span className="text-[19px] font-bold">{props.title}</span>
        <span className="text-sm text-muted">{props.body}</span>
      </span>
    </button>
  );
}
