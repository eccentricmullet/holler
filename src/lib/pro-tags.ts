import type { SupabaseClient } from "@supabase/supabase-js";

// Each pro's service tags: category slugs from the fixed list, main one first (redesign phase 2).
export type TagInfo = { slug: string; name: string; icon: string };

export const MAX_PRO_TAGS = 6;

// "🌿 Lawn · 🌳 Landscaping · 🪜 Gutters" (unknown slugs are skipped)
export function formatTags(tags: string[] | null | undefined, cats: TagInfo[], max = 3) {
  return (tags ?? [])
    .map((t) => cats.find((c) => c.slug === t))
    .filter((c): c is TagInfo => !!c)
    .slice(0, max)
    .map((c) => `${c.icon} ${c.name}`)
    .join(" · ");
}

export function tagNames(tags: string[] | null | undefined, cats: TagInfo[]) {
  return (tags ?? []).map((t) => cats.find((c) => c.slug === t)?.name).filter((n): n is string => !!n);
}

// Existing tags keep their order; new ones go on the end. Unknown slugs are dropped.
export function mergeTags(current: string[], add: string[], cats: TagInfo[]) {
  const known = new Set(cats.map((c) => c.slug));
  const out = [...current];
  for (const t of add) if (known.has(t) && !out.includes(t)) out.push(t);
  return out;
}

export async function loadTagInfo(db: SupabaseClient): Promise<TagInfo[]> {
  const { data } = await db.from("categories").select("slug, name, icon").order("sort_order");
  return (data ?? []) as TagInfo[];
}

// Neighbors can add tags to a pro, never remove them (only an admin can).
export async function addProTags(db: SupabaseClient, proId: string, add: string[], cats?: TagInfo[]) {
  const info = cats ?? (await loadTagInfo(db));
  const { data: pro } = await db.from("pros").select("tags").eq("id", proId).maybeSingle();
  if (!pro) return null;
  const current = (pro.tags ?? []) as string[];
  const next = mergeTags(current, add, info);
  if (next.length !== current.length) await db.from("pros").update({ tags: next }).eq("id", proId);
  return next;
}
