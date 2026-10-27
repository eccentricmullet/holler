// The Curb (redesign phase 4): item types and filter chips. Shared by server and browser.
export type CurbKind = "kids" | "furniture" | "tools" | "other";
export type CurbFilter = "all" | "free" | "under25" | CurbKind;

export const CURB_KINDS: { id: CurbKind; label: string; emoji: string }[] = [
  { id: "kids", label: "Kids", emoji: "🧸" },
  { id: "furniture", label: "Furniture", emoji: "🛋️" },
  { id: "tools", label: "Tools", emoji: "🛠️" },
  { id: "other", label: "Other", emoji: "📦" },
];

export const CURB_FILTERS: { id: CurbFilter; label: string; emoji: string | null }[] = [
  { id: "all", label: "All", emoji: null },
  { id: "free", label: "Free", emoji: "🆓" },
  { id: "under25", label: "Under $25", emoji: "💵" },
  { id: "kids", label: "Kids", emoji: "🧸" },
  { id: "furniture", label: "Furniture", emoji: "🛋️" },
  { id: "tools", label: "Tools", emoji: "🛠️" },
];

export const isCurbKind = (k: unknown): k is CurbKind => CURB_KINDS.some((x) => x.id === k);
export const isCurbFilter = (f: unknown): f is CurbFilter => CURB_FILTERS.some((x) => x.id === f);

export const CURB_DAYS = 14; // items come down on their own after two weeks
export const CURB_MAX_PHOTOS = 4;
export const CURB_TITLE_MAX = 60;
export const CURB_NOTE_MAX = 200;
export const CURB_PRICE_MAX = 100000;

// "$25", "Free"
export const priceLabel = (price: number) => (price === 0 ? "Free" : `$${price.toLocaleString("en-US")}`);
