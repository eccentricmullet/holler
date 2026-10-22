// The Porch (11k): post types, their tabs, and how long they stay up. Shared by server and browser.
export type PorchKind =
  | "just_hired"
  | "garage_sale"
  | "curb_alert"
  | "lost_pet"
  | "found_pet"
  | "event"
  | "heads_up"
  | "new_neighbor";

// Filter chips on the Porch (redesign phase 3). "pros" = requests for a pro; "answered" = requests neighbors answered.
export type PorchTab = "all" | "pros" | "sales" | "pets" | "answered";

type KindInfo = {
  label: string;
  emoji: string;
  tab: "sales" | "pets" | null; // null = shows under All only
  prompt: string; // placeholder text in the post box
  needsDate?: boolean; // garage sales and events
  hasTimes?: boolean; // garage sales: a time window and an address for directions
  days: number; // how long it stays up (date-based kinds: until the day after)
  doneLabel?: string; // the poster can mark it done ("Taken", "Found")
  action?: { id: "seen_pet" | "going"; label: string; done: string };
};

export const KINDS: Record<PorchKind, KindInfo> = {
  just_hired: { label: "Just hired", emoji: "📸", tab: null, prompt: "Who did a great job for you? Tag them below.", days: 14 },
  garage_sale: { label: "Garage sale", emoji: "🏷️", tab: "sales", prompt: "What's for sale? Baby gear, tools, furniture…", needsDate: true, hasTimes: true, days: 1, action: { id: "going", label: "Going", done: "Going ✓" } },
  curb_alert: { label: "Curb alert", emoji: "🎁", tab: null, prompt: "Free stuff on the curb. What and where?", days: 2, doneLabel: "Taken" },
  lost_pet: { label: "Lost pet", emoji: "🐾", tab: "pets", prompt: "Name, what they look like, last seen where?", days: 14, doneLabel: "Found", action: { id: "seen_pet", label: "I've seen this pet", done: "You've seen it ✓" } },
  found_pet: { label: "Found pet", emoji: "🐶", tab: "pets", prompt: "What they look like and where you found them.", days: 14, doneLabel: "Back home" },
  event: { label: "Event", emoji: "🎉", tab: null, prompt: "What's happening, when and where?", needsDate: true, days: 1, action: { id: "going", label: "Going", done: "Going ✓" } },
  heads_up: { label: "Heads-up", emoji: "⚠️", tab: null, prompt: "Road closed? Power out? Keep it to the facts.", days: 3, doneLabel: "Resolved" },
  new_neighbor: { label: "New neighbor", emoji: "👋", tab: null, prompt: "Just moved in? Say hi!", days: 14 },
};

export const TABS: { id: PorchTab; label: string; emoji: string | null }[] = [
  { id: "all", label: "All", emoji: null },
  { id: "pros", label: "Need a pro", emoji: "🔧" },
  { id: "sales", label: "Garage sales", emoji: "🏷️" },
  { id: "pets", label: "Pets", emoji: "🐾" },
  { id: "answered", label: "Answered", emoji: "✅" },
];
export const isTab = (t: unknown): t is PorchTab => TABS.some((x) => x.id === t);

// Heads-up posts stay factual: these topics only (no "suspicious person" posts).
export const HEADS_UP_TOPICS = [
  { id: "roads", label: "Roads", emoji: "🚧" },
  { id: "weather", label: "Weather", emoji: "⛈️" },
  { id: "power", label: "Power", emoji: "🔌" },
  { id: "water", label: "Water", emoji: "💧" },
] as const;

export const isKind = (k: unknown): k is PorchKind => typeof k === "string" && k in KINDS;
