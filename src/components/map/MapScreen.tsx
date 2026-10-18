"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import CategorySheet from "./CategorySheet";
import MapView from "./MapView";
import ProCards, { ProCardsSkeleton } from "./ProCards";
import type { Category, LatLng, NearbyPro, Pin } from "./types";

const DEFAULT_CATEGORY = "lawn";

type Props = {
  categories: Category[];
  center: LatLng;
  home: { point: LatLng; initial: string } | null;
  placeName: string;
  signedIn: boolean;
};

const controlClass =
  "flex size-12 items-center justify-center rounded-2xl bg-surface text-ink shadow-control";

// "an HVAC pro", "a lawn pro"
function article(word: string) {
  return /^(hvac|[aeiou])/i.test(word) ? "an" : "a";
}

// "roofing", but keep acronyms like "HVAC"
function proWord(name: string) {
  return name === name.toUpperCase() ? name : name.toLowerCase();
}

export default function MapScreen({ categories, center, home, placeName, signedIn }: Props) {
  const supabase = useRef(createClient()).current;
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [pros, setPros] = useState<NearbyPro[] | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [error, setError] = useState(false);

  const current = categories.find((c) => c.slug === category);

  useEffect(() => {
    let stale = false;
    setPros(null);
    setSelectedId(null);
    setError(false);
    (async () => {
      const args = { lat: center.lat, lng: center.lng, category };
      const [prosRes, pinsRes] = await Promise.all([
        supabase.rpc("pros_near", args),
        supabase.rpc("map_pins", args),
      ]);
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

  const pinCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of pins) counts[p.pro_id] = (counts[p.pro_id] ?? 0) + 1;
    return counts;
  }, [pins]);

  const reactHref = signedIn ? "/react" : "/signup";

  return (
    <main className="fixed inset-0 overflow-hidden bg-field">
      <MapView
        center={center}
        home={home}
        satellite={satellite}
        pins={pins}
        pros={pros ?? []}
        selectedId={selectedId}
        onSelect={setSelectedId}
        recenterKey={recenterKey}
      />

      {/* Title */}
      <div className="pointer-events-none absolute left-6 top-7 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`pointer-events-auto flex items-center gap-2 ${satellite ? "text-white drop-shadow" : "text-ink"}`}
        >
          <span className="text-4xl font-extrabold leading-none tracking-[-0.02em]">{current?.name ?? "Pros"}</span>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <span className={`text-[15px] ${satellite ? "text-white drop-shadow" : "text-muted"}`}>Who {placeName} uses</span>
      </div>

      {/* Right-side controls */}
      <div className="absolute right-5 top-7 flex flex-col gap-3">
        {signedIn && home ? (
          <span
            aria-label="My profile"
            role="img"
            className="flex size-12 items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-white shadow-control"
          >
            {home.initial}
          </span>
        ) : (
          <Link href="/signup" aria-label="Sign up or log in" className={controlClass}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </Link>
        )}
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

      {/* Bottom: pro cards, empty state, or loading */}
      <div className="absolute inset-x-0 bottom-0">
        {pros === null ? (
          <ProCardsSkeleton />
        ) : pros.length === 0 ? (
          <div className="mx-5 mb-7 rounded-[28px] bg-surface p-5 shadow-float">
            <p className="text-lg font-bold leading-snug">
              {error
                ? "We couldn't load pros right now. Try again in a minute."
                : `No one's reacted to ${article(current?.name ?? "")} ${proWord(current?.name ?? "")} pro near you yet.`}
            </p>
            {!error && (
              <Link
                href={reactHref}
                className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-green-deep text-[15px] font-semibold text-white"
              >
                Know a good one?
              </Link>
            )}
          </div>
        ) : (
          <ProCards pros={pros} pinCounts={pinCounts} selectedId={selectedId} onSelect={setSelectedId} />
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
