// Best guess at a category from a business's name and Google types. The user always confirms it.
const RULES: [slug: string, pattern: RegExp][] = [
  ["pool", /pool|spa\b/i],
  ["lawn", /lawn|mow|landscap|yard|turf|grass/i],
  ["hvac", /hvac|heating|cooling|air cond|\bair\b|furnace/i],
  ["plumbing", /plumb|drain|sewer|water heater/i],
  ["electrical", /electric/i],
  ["roofing", /roof/i],
  ["pest", /pest|termite|bug|exterminat|mosquito/i],
  ["cleaning", /clean|maid|janitor/i],
  ["painting", /paint/i],
  ["pressure-washing", /pressure|power wash|soft wash/i],
  ["tree-service", /tree|arbor|stump/i],
  ["handyman", /handy|repair|fix/i],
];

export function guessCategory(name: string, types: string[] = []): string | null {
  const text = `${name} ${types.join(" ").replace(/_/g, " ")}`;
  return RULES.find(([, re]) => re.test(text))?.[0] ?? null;
}
