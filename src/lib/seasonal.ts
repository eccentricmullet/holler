// 11g: friendly seasonal prompts on the map ("Gutter season 🍂: who cleaned yours?").
// Each month has a couple of prompts; one is picked per week so it doesn't change on every visit.
export type Nudge = { id: string; category: string; emoji: string; title: string; question: string };

const BY_MONTH: Record<number, Nudge[]> = {
  0: [
    { id: "heat", category: "hvac", emoji: "🔥", title: "Heating season", question: "Who keeps your heat running?" },
    { id: "pipes", category: "plumbing", emoji: "🥶", title: "Frozen pipe season", question: "Who's your go-to plumber?" },
  ],
  1: [
    { id: "heat", category: "hvac", emoji: "🔥", title: "Heating season", question: "Who keeps your heat running?" },
    { id: "pipes", category: "plumbing", emoji: "🥶", title: "Frozen pipe season", question: "Who's your go-to plumber?" },
  ],
  2: [
    { id: "trees", category: "tree-service", emoji: "🌳", title: "Storm cleanup season", question: "Who trims your trees?" },
    { id: "spring-clean", category: "cleaning", emoji: "🧹", title: "Spring cleaning", question: "Who helps you get it done?" },
  ],
  3: [
    { id: "mowing", category: "lawn", emoji: "🌱", title: "Mowing season", question: "Who cuts your grass?" },
    { id: "pool-open", category: "pool", emoji: "🏊", title: "Pool opening time", question: "Who opens your pool?" },
  ],
  4: [
    { id: "mowing", category: "lawn", emoji: "🌱", title: "Mowing season", question: "Who cuts your grass?" },
    { id: "pressure", category: "pressure-washing", emoji: "💦", title: "Pressure washing season", question: "Who makes your driveway shine?" },
  ],
  5: [
    { id: "ac", category: "hvac", emoji: "❄️", title: "AC season", question: "Who keeps you cool?" },
    { id: "pool", category: "pool", emoji: "🏊", title: "Pool season", question: "Who keeps your pool clean?" },
  ],
  6: [
    { id: "ac", category: "hvac", emoji: "❄️", title: "AC season", question: "Who keeps you cool?" },
    { id: "bugs", category: "pest", emoji: "🐜", title: "Bug season", question: "Who keeps the pests away?" },
  ],
  7: [
    { id: "bugs", category: "pest", emoji: "🐜", title: "Bug season", question: "Who keeps the pests away?" },
    { id: "move", category: "movers", emoji: "📦", title: "Moving season", question: "Who moved you in?" },
  ],
  8: [
    { id: "gutters", category: "gutter-cleaning", emoji: "🍂", title: "Gutter season", question: "Who cleaned yours?" },
    { id: "windows", category: "window-cleaning", emoji: "🪟", title: "Fall window cleaning", question: "Who does your windows?" },
  ],
  9: [
    { id: "gutters", category: "gutter-cleaning", emoji: "🍂", title: "Gutter season", question: "Who cleaned yours?" },
    { id: "heat-check", category: "hvac", emoji: "🔥", title: "Furnace check time", question: "Who services your heat?" },
  ],
  10: [
    { id: "gutters", category: "gutter-cleaning", emoji: "🍂", title: "Gutter season", question: "Who cleaned yours?" },
    { id: "leaves", category: "lawn", emoji: "🍁", title: "Leaf season", question: "Who clears your leaves?" },
  ],
  11: [
    { id: "heat", category: "hvac", emoji: "🔥", title: "Heating season", question: "Who keeps your heat running?" },
    { id: "lights", category: "electrical", emoji: "💡", title: "Holiday lights", question: "Who's your electrician?" },
  ],
};

export function currentNudge(now: Date = new Date()): Nudge {
  const options = BY_MONTH[now.getMonth()];
  const week = Math.floor(now.getDate() / 7);
  return options[week % options.length];
}

// Key for remembering a dismissed banner until the next prompt comes around
export const nudgeKey = (n: Nudge, now: Date = new Date()) => `holler-nudge-${n.id}-${now.getFullYear()}-${now.getMonth()}`;
