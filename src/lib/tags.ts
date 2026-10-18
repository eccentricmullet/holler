// Optional one-tap details on a reaction (11b) and the price hint (11c).
export const TAGS = [
  { id: "on_time", label: "On time", emoji: "⏰" },
  { id: "fair_price", label: "Fair price", emoji: "💵" },
  { id: "quick_reply", label: "Quick to reply", emoji: "⚡" },
  { id: "clean_work", label: "Clean work", emoji: "✨" },
  { id: "would_rehire", label: "Would rehire", emoji: "🔁" },
] as const;

export type TagId = (typeof TAGS)[number]["id"];
export const TAG_IDS: readonly string[] = TAGS.map((t) => t.id);

export const PRICES = [
  { value: 1, label: "$", hint: "Budget-friendly" },
  { value: 2, label: "$$", hint: "Average" },
  { value: 3, label: "$$$", hint: "Pricey" },
] as const;

export function cleanTags(tags: unknown): TagId[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((t): t is TagId => typeof t === "string" && TAG_IDS.includes(t)))];
}

export function cleanPrice(price: unknown): 1 | 2 | 3 | null {
  return price === 1 || price === 2 || price === 3 ? price : null;
}
