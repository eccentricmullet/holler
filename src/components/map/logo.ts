// Business logos bring their own colors. When a pro has no logo yet, show colored initials
// using the business colors from docs/mockups/GreenMap.dc.html.
const FALLBACK_COLORS = ["#2F9E44", "#D9480F", "#6741D9"];

export function logoColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

export function initials(name: string) {
  const words = name.replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}
