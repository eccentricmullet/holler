"use client";

import Link from "next/link";
import ProLogo from "./ProLogo";
import { TrackedLink } from "@/components/Track";
import type { NearbyPro } from "./types";

// Laptop sidebar list. Hovering a pro highlights their logos on the map.
export default function ProList(props: {
  pros: NearbyPro[];
  pinCounts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" onMouseLeave={() => props.onHover(null)}>
      {props.pros.map((p) => {
        const on = p.id === props.selectedId;
        return (
          <li
            key={p.id}
            onMouseEnter={() => props.onHover(p.id)}
            onClick={() => props.onSelect(p.id)}
            className={`flex cursor-pointer items-center gap-3 rounded-[20px] border-2 p-3 transition-colors ${
              on ? "border-green bg-green-wash" : "border-transparent hover:bg-field"
            }`}
          >
            <ProLogo name={p.name} logoUrl={p.logo_url} size={44} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-bold">{p.name}</span>
              <span className="flex items-center gap-2.5 text-sm font-semibold">
                <span>👍 {p.thumbs_total}</span>
                <span>❤️ {p.love_total}</span>
                <span className="font-normal text-muted">{props.pinCounts[p.id] ?? 0} on map</span>
              </span>
            </span>
            {p.phone && (
              <TrackedLink
                href={`tel:${p.phone}`}
                event="tapped_call"
                props={{ pro_id: p.id, from: "map_list" }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Call ${p.name}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-deep text-white"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                </svg>
              </TrackedLink>
            )}
            <Link
              href={`/pro/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`View ${p.name}`}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-field text-ink"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
