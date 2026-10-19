"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CategorySheet from "./CategorySheet";
import MapView from "./MapView";
import ProCards, { ProCardsSkeleton } from "./ProCards";
import ProList from "./ProList";
import SeasonalBanner from "./SeasonalBanner";
import PorchButton from "@/components/PorchButton";
import { DEFAULT_CATEGORY, type Category, type LatLng, type NearbyPro, type Pin } from "./types";

type Props = {
  categories: Category[];
  center: LatLng;
  home: { point: LatLng; initial: string } | null;
  placeName: string;
  signedIn: boolean;
  farFromLaunch: boolean;
  // Loaded on the server for the default category so cards show right away
  initialPros: NearbyPro[] | null;
  initialPins: Pin[];
  initialColors: Record<string, string>; // each pro's own pin color (11j)
};

const controlClass = "flex size-12 items-center justify-center rounded-2xl bg-surface text-ink shadow-control";

// "an HVAC pro", "a lawn pro"
function article(word: string) {
  return /^(hvac|[aeiou])/i.test(word) ? "an" : "a";
}

// "roofing", but keep acronyms like "HVAC"
function proWord(name: string) {
  return name === name.toUpperCase() ? name : name.toLowerCase();
}

export default function MapScreen(props: Props) {
  const { categories, center, home, placeName, signedIn, farFromLaunch } = props;
  const supabase = useRef(createClient()).current;
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [pros, setPros] = useState<NearbyPro[] | null>(props.initialPros);
  const [pins, setPins] = useState<Pin[]>(props.initialPins);
  const [error, setError] = useState(false);
  const usedInitial = useRef(props.initialPros !== null);

  const current = categories.find((c) => c.slug === category);

  useEffect(() => {
    // The server already loaded the first category
    if (usedInitial.current && category === DEFAULT_CATEGORY) {
      usedInitial.current = false;
      return;
    }
    usedInitial.current = false;
    let stale = false;
    setPros(null);
    setSelectedId(null);
    setError(false);
    (async () => {
      const args = { lat: center.lat, lng: center.lng, category };
      const [prosRes, pinsRes] = await Promise.all([supabase.rpc("pros_near", args), supabase.rpc("map_pins", args)]);
      if (stale) return;
      if (prosRes.error || pinsRes.error) {
        setError(true);
        setPros([]);
        setPins([]);
        return;
      }
      setPros(prosRes.data as NearbyPro[]);
      setPins(pinsRes.data as Pin[]);
    })();
    return () => {
      stale = true;
    };
  }, [category, center.lat, center.lng, supabase]);

  // When each pro was most recently used (11d), for "this fall" on cards
  const [latest, setLatest] = useState<Record<string, string>>({});
  const [colors, setColors] = useState<Record<string, string>>(props.initialColors);
  useEffect(() => {
    if (!pros?.length) return;
    const ctrl = new AbortController();
    fetch(`/api/pros/latest?ids=${pros.map((p) => p.id).join(",")}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setLatest((cur) => ({ ...cur, ...d.latest }));
        setColors((cur) => ({ ...cur, ...d.colors }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [pros]);

  const pinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of pins) counts[p.pro_id] = (counts[p.pro_id] ?? 0) + 1;
    return counts;
  }, [pins]);

  const reactHref = signedIn ? "/react" : "/signup";

  const title = (onDark: boolean) => (
    <>
      <button type="button" onClick={() => setSheetOpen(true)} className={`flex items-center gap-2 ${onDark ? "text-white drop-shadow" : "text-ink"}`}>
        <span className="text-4xl font-extrabold leading-none tracking-[-0.02em]">{current?.name ?? "Pros"}</span>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <span className={`text-[15px] ${onDark ? "text-white drop-shadow" : "text-muted"}`}>Who {placeName} uses</span>
    </>
  );

  const emptyState = (
    <div className="rounded-[28px] bg-surface p-5 shadow-float lg:shadow-none">
      <p className="text-lg font-bold leading-snug">
        {error
          ? "We couldn't load pros right now. Try again in a minute."
          : `No one's reacted to ${article(current?.name ?? "")} ${proWord(current?.name ?? "")} pro near you yet.`}
      </p>
      {!error && (
        <div className="mt-4 flex gap-2">
          <Link href={reactHref} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-green-deep text-[15px] font-semibold text-white">
            Know a good one?
          </Link>
          <Link
            href={signedIn ? `/asks/new?category=${category}` : `/signup?next=${encodeURIComponent(`/asks/new?category=${category}`)}`}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-green-tint text-[15px] font-semibold text-green-deep"
          >
            Ask your neighbors
          </Link>
        </div>
      )}
    </div>
  );

  // Neighbors asking near you, or answers on your own asks (11h)
  const [askSummary, setAskSummary] = useState<{ near: number; answers: number }>({ near: 0, answers: 0 });
  useEffect(() => {
    if (!signedIn) return;
    fetch("/api/asks/summary")
      .then((r) => r.json())
      .then(setAskSummary)
      .catch(() => {});
  }, [signedIn]);
  const askChip =
    askSummary.answers > 0 || askSummary.near > 0 ? (
      <Link href="/asks" className="flex items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold text-white shadow-control">
        {askSummary.answers > 0
          ? `📬 Your ask got ${askSummary.answers} ${askSummary.answers === 1 ? "answer" : "answers"}`
          : `🙋 ${askSummary.near} ${askSummary.near === 1 ? "neighbor needs" : "neighbors need"} a pro`}
      </Link>
    ) : null;

  const unlockCard = farFromLaunch && (
    <Link href="/unlock" className="flex items-center gap-3 rounded-[22px] bg-dark-card px-4 py-3.5 text-white shadow-float">
      <span className="text-2xl" aria-hidden>
        📣
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-bold">We&apos;re just getting started here</span>
        <span className="text-[13px] text-white/70">Get neighbors on the list to unlock your town →</span>
      </span>
    </Link>
  );

  return (
    <main className="fixed inset-0 overflow-hidden bg-field">
      <MapView
        center={center}
        home={home}
        satellite={satellite}
        pins={pins}
        pros={pros ?? []}
        colors={colors}
        selectedId={hoverId ?? selectedId}
        onSelect={setSelectedId}
        recenterKey={recenterKey}
      />

      {/* Phone: title floats on the map */}
      <div className="absolute left-6 top-7 flex flex-col gap-0.5 lg:hidden">{title(satellite)}</div>
      {/* Seasonal prompt under the title (leaves room for the buttons on the right) */}
      <div className="absolute left-5 right-[84px] top-[118px] flex flex-col items-start gap-2 lg:hidden">
        <SeasonalBanner signedIn={signedIn} className="w-full" />
        {askChip}
      </div>

      {/* Laptop: sidebar with the title and the pro list */}
      <aside className="absolute bottom-5 left-5 top-5 hidden w-[380px] flex-col overflow-hidden rounded-[28px] bg-surface shadow-float lg:flex">
        <div className="flex flex-col gap-0.5 px-6 pb-4 pt-6">{title(false)}</div>
        <SeasonalBanner signedIn={signedIn} className="mx-3 mb-3 bg-field shadow-none" />
        {askChip && <div className="mx-3 mb-3">{askChip}</div>}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {pros === null ? (
            <div className="flex flex-col gap-2 px-1" aria-label="Loading pros">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[68px] animate-pulse rounded-[20px] bg-field" />
              ))}
            </div>
          ) : pros.length === 0 ? (
            <div className="px-1">{emptyState}</div>
          ) : (
            <ProList pros={pros} pinCounts={pinCounts} latest={latest} colors={colors} selectedId={selectedId} onSelect={setSelectedId} onHover={setHoverId} />
          )}
        </div>
        {unlockCard && <div className="p-3">{unlockCard}</div>}
      </aside>

      {/* Right-side controls */}
      <div className="absolute right-5 top-7 flex flex-col gap-3">
        {signedIn && home ? (
          <Link
            href="/profile"
            aria-label="My profile"
            className="flex size-12 items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-white shadow-control"
          >
            {home.initial}
          </Link>
        ) : (
          <Link href="/signup" aria-label="Sign up or log in" className={controlClass}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </Link>
        )}
        <PorchButton signedIn={signedIn} />
        <button type="button" aria-label="All categories" onClick={() => setSheetOpen(true)} className={controlClass}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <circle cx="7" cy="7" r="2.2" fill="currentColor" />
            <circle cx="17" cy="7" r="2.2" fill="currentColor" />
            <circle cx="7" cy="17" r="2.2" fill="currentColor" />
            <circle cx="17" cy="17" r="2.2" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={satellite ? "Switch to street map" : "Switch to satellite"}
          aria-pressed={satellite}
          onClick={() => setSatellite((s) => !s)}
          className={controlClass}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3l9 5-9 5-9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={home ? "Center on my home" : "Center the map"}
          onClick={() => setRecenterKey((k) => k + 1)}
          className={controlClass}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
        <Link
          href={reactHref}
          aria-label="React to a pro you use"
          className="flex size-14 items-center justify-center self-end rounded-[20px] bg-green-deep text-white shadow-[0_8px_20px_rgba(23,138,53,0.35)]"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>

      {/* Phone: pro cards, empty state, or loading along the bottom */}
      <div className="absolute inset-x-0 bottom-0 lg:hidden">
        {unlockCard && <div className="mx-5 mb-1">{unlockCard}</div>}
        {pros === null ? (
          <ProCardsSkeleton />
        ) : pros.length === 0 ? (
          <div className="mx-5 mb-7">{emptyState}</div>
        ) : (
          <ProCards pros={pros} pinCounts={pinCounts} latest={latest} colors={colors} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>

      {sheetOpen && (
        <CategorySheet
          categories={categories}
          current={category}
          onPick={(slug) => {
            setCategory(slug);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  );
}
