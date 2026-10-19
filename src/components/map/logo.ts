// Business logos bring their own colors. Until a pro has a logo, they get their own saved
// color (src/lib/pro-colors.ts). This fallback is only for the moment before one is assigned.
const FALLBACK_COLORS = ["#E8590C", "#1971C2", "#C2255C", "#6741D9", "#0C8599"];

export function logoColor(name: string, color?: string | null) {
  if (color) return color;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

export function initials(name: string) {
  const words = name.replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}
