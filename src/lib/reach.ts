// How far "neighbors" reaches for The Porch and ask alerts. Each person picks; 3 miles to start.
export const REACH_OPTIONS = [
  { miles: 1, label: "1 mi", emoji: "📍", hint: "My neighborhood" },
  { miles: 3, label: "3 mi", emoji: "🏘️", hint: "Nearby" },
  { miles: 5, label: "5 mi", emoji: "🗺️", hint: "The whole town" },
] as const;

export type ReachMiles = (typeof REACH_OPTIONS)[number]["miles"];
export const DEFAULT_REACH: ReachMiles = 3;

export const isReach = (m: unknown): m is ReachMiles => m === 1 || m === 3 || m === 5;
export const reachMeters = (miles: number | null | undefined) => (isReach(miles) ? miles : DEFAULT_REACH) * 1609.34;
