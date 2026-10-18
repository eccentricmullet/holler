// Best guess at a category from a business's name and Google types. The user always confirms it.
// More specific rules come first ("pressure washing" before "cleaning", "gutter" before "roof").
const RULES: [slug: string, pattern: RegExp][] = [
  ["pool", /\bpools?\b|\bspa\b/i],
  ["gutter-cleaning", /gutter/i],
  ["pressure-washing", /pressure|power wash|soft wash/i],
  ["window-cleaning", /window clean|window wash/i],
  ["tree-service", /\btrees?\b|arbor|stump/i],
  ["landscaping", /landscap|hardscap|mulch|garden design/i],
  ["lawn", /lawn|mow|yard|turf|grass/i],
  ["hvac", /hvac|heating|cooling|air cond|\bair\b|furnace/i],
  ["plumbing", /plumb|drain|sewer|water heater/i],
  ["electrical", /electric/i],
  ["roofing", /roof/i],
  ["fencing", /fenc/i],
  ["pest", /pest|termite|bug|exterminat|mosquito/i],
  ["flooring", /floor|carpet|tile|hardwood/i],
  ["appliance-repair", /appliance|washer|dryer|refrigerator|fridge/i],
  ["garage-doors", /garage door|overhead door/i],
  ["junk-removal", /junk|haul|debris|dumpster/i],
  ["movers", /\bmov(ers?|ing)\b|relocat/i],
  ["dog-walking", /dog walk|pet sit|walker/i],
  ["pet-grooming", /groom|pet spa|\bpaws?\b/i],
  ["car-care", /auto|car wash|detail|mechanic|tire/i],
  ["florist", /flor(ist|al)|flowers?|bouquet/i],
  ["painting", /paint/i],
  ["cleaning", /clean|maid|janitor/i],
  ["handyman", /handy|repair|fix/i],
];

export function guessCategory(name: string, types: string[] = []): string | null {
  const text = `${name} ${types.join(" ").replace(/_/g, " ")}`;
  return RULES.find(([, re]) => re.test(text))?.[0] ?? null;
}
