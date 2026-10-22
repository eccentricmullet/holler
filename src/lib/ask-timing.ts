// When a neighbor needs the pro (pro requests on the Porch). Shared by server and browser.
export const TIMINGS = [
  { id: "asap", label: "ASAP" },
  { id: "this_week", label: "This week" },
  { id: "planning", label: "Just planning" },
  { id: "date", label: "Pick a date" },
] as const;
export type Timing = (typeof TIMINGS)[number]["id"];
export const isTiming = (t: unknown): t is Timing => TIMINGS.some((x) => x.id === t);
