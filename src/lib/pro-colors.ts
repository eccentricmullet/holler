import type { SupabaseClient } from "@supabase/supabase-js";

// 11j: every pro gets its own pin color, so three lawn pros never look alike.
// Bright, easy to tell apart, white text reads on all of them. No greens: green is
// Holler's own color (buttons, grouped-pin bubbles). Listed in docs/DESIGN.md.
export const PRO_COLORS = [
  "#E8590C", // orange
  "#1971C2", // blue
  "#C2255C", // raspberry
  "#6741D9", // purple
  "#0C8599", // teal
  "#F08C00", // amber
  "#E03131", // red
  "#364FC7", // indigo
  "#862E9C", // plum
  "#8D5524", // brown
] as const;

// Picks a color no other pro in the same categories is using (or the least-used one).
export async function assignProColor(db: SupabaseClient, proId: string): Promise<string | null> {
  const { data: pro } = await db.from("pros").select("id, color").eq("id", proId).maybeSingle();
  if (!pro) return null;
  if (pro.color) return pro.color;

  const { data: mine } = await db.from("vouches").select("category_id").eq("pro_id", proId);
  const categories = [...new Set((mine ?? []).map((v) => v.category_id))];

  // Pros sharing any of those categories, and the colors they already have
  let rivals: string[] = [];
  if (categories.length) {
    const { data } = await db.from("vouches").select("pro_id").in("category_id", categories).neq("pro_id", proId).limit(5000);
    rivals = [...new Set((data ?? []).map((v) => v.pro_id))];
  }
  const used = new Map<string, number>();
  if (rivals.length) {
    const { data } = await db.from("pros").select("color").in("id", rivals).not("color", "is", null);
    for (const r of data ?? []) used.set(r.color, (used.get(r.color) ?? 0) + 1);
  }

  const color =
    PRO_COLORS.find((c) => !used.has(c)) ?? [...PRO_COLORS].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))[0];
  await db.from("pros").update({ color }).eq("id", proId).is("color", null);
  return color;
}

// Gives every pro without a color one, busiest pros first (run once after adding colors).
export async function backfillProColors(db: SupabaseClient) {
  const { data: pros } = await db.from("pros").select("id, vouches(count)").is("color", null).eq("status", "active");
  const ordered = (pros ?? []).sort(
    (a, b) => ((b.vouches as unknown as { count: number }[])[0]?.count ?? 0) - ((a.vouches as unknown as { count: number }[])[0]?.count ?? 0)
  );
  for (const p of ordered) await assignProColor(db, p.id);
  return ordered.length;
}
