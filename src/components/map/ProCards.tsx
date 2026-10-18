"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import ProLogo from "./ProLogo";
import type { NearbyPro } from "./types";

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// Swipeable cards along the bottom. The selected pro gets the big green card.
export default function ProCards(props: {
  pros: NearbyPro[];
  pinCounts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (props.selectedId) refs.current[props.selectedId]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [props.selectedId]);

  return (
    <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 items-end gap-3.5 overflow-x-auto px-5 pb-7 pt-4">
      {props.pros.map((p) => {
        const on = p.id === props.selectedId;
        const thumbs = p.thumbs_total;
        const love = p.love_total;
        const onMap = props.pinCounts[p.id] ?? 0;
        return (
          <div
            key={p.id}
            ref={(el) => {
              refs.current[p.id] = el;
            }}
            onClick={() => props.onSelect(p.id)}
            className={`relative flex shrink-0 snap-start cursor-pointer flex-col overflow-hidden bg-surface shadow-float transition-all ${
              on ? "h-[252px] w-[236px] rounded-[28px] p-5" : "h-[214px] w-[176px] rounded-[26px] p-[18px]"
            }`}
          >
            {on && (
              <>
                <span className="absolute -right-[50px] -top-[60px] size-[190px] rounded-full bg-green" aria-hidden />
                <span className="absolute -right-2.5 -top-[90px] size-[150px] rounded-full bg-lime" aria-hidden />
              </>
            )}
            <ProLogo name={p.name} logoUrl={p.logo_url} size={on ? 56 : 48} />
            <span className={`relative font-bold leading-[1.15] ${on ? "mt-[18px] text-xl" : "mt-3.5 text-lg"}`}>{p.name}</span>
            <span className="relative mt-2 flex items-center gap-3 text-base font-semibold">
              <span>👍 {thumbs}</span>
              <span>❤️ {love}</span>
              {on && <span className="text-sm font-medium text-muted">{onMap} on map</span>}
            </span>
            {on ? (
              <span className="mt-auto flex gap-2">
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-green-deep text-[15px] font-semibold text-white"
                  >
                    <PhoneIcon />
                    Call
                  </a>
                )}
                <Link
                  href={`/pro/${p.id}`}
                  aria-label={`View ${p.name}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex size-12 items-center justify-center rounded-2xl bg-field text-ink"
                >
                  <ChevronIcon />
                </Link>
              </span>
            ) : (
              <span className="mt-auto text-[13px] text-muted">{onMap} on map</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProCardsSkeleton() {
  return (
    <div className="flex items-end gap-3.5 overflow-hidden px-5 pb-7 pt-4" aria-label="Loading pros">
      <div className="h-[252px] w-[236px] shrink-0 animate-pulse rounded-[28px] bg-surface shadow-float" />
      <div className="h-[214px] w-[176px] shrink-0 animate-pulse rounded-[26px] bg-surface shadow-float" />
    </div>
  );
}
