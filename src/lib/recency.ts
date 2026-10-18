// "this fall", "last summer", "spring 2025": when a neighbor's reaction happened, in everyday words.
const SEASONS = ["winter", "spring", "summer", "fall"] as const;

// Winter spans the new year (Dec–Feb), so December counts toward the next year's winter.
function seasonOf(d: Date) {
  const m = d.getMonth(); // 0 = Jan
  const index = m === 11 || m <= 1 ? 0 : m <= 4 ? 1 : m <= 7 ? 2 : 3;
  const year = m === 11 ? d.getFullYear() + 1 : d.getFullYear();
  return { index, year, serial: year * 4 + index };
}

export function whenLabel(date: string | Date, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = seasonOf(d);
  const n = seasonOf(now);
  const name = SEASONS[s.index];
  if (s.serial >= n.serial) return `this ${name}`;
  if (s.serial === n.serial - 1) return `last ${name}`;
  if (n.serial - s.serial < 8) return `${name} ${s.year}`;
  return String(d.getFullYear());
}
