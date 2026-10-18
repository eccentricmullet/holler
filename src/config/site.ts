// Change the app name here and it changes everywhere.
export const SITE = {
  name: "Holler",
  wordmark: "holler",
  tagline: "A map of the pros your neighbors trust",
  launchTown: "Spring Hill, TN",
  launchTownShort: "Spring Hill",
  // Address and business search lean toward here first.
  launchCenter: { lat: 35.7512, lng: -86.93 },
  // Waitlist signups needed in a ZIP code before that town unlocks (open question in SPEC; 100 to start).
  unlockThreshold: 100,
  // Homes farther than this from the launch town see the "unlock your town" card.
  launchRadiusM: 40_000,
} as const;
