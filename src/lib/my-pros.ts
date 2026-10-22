import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTags, loadTagInfo } from "@/lib/pro-tags";

export type MyPro = {
  id: string;
  name: string;
  logoUrl: string | null;
  reaction: "thumbs_up" | "love" | null; // this person's reaction, if any
  category: string | null; // their service tags, e.g. "🌿 Lawn · 🪜 Gutters"
  saved: boolean;
};

// A person's pros: the ones they saved plus the ones they reacted to (visible, active pros only).
export async function listMyPros(db: SupabaseClient, profileId: string): Promise<MyPro[]> {
  const [{ data: saved }, { data: reacted }, cats] = await Promise.all([
    db.from("saved_pros").select("created_at, pros(id, name, logo_url, status, tags)").eq("profile_id", profileId).order("created_at", { ascending: false }),
    db
      .from("vouches")
      .select("reaction, created_at, pros(id, name, logo_url, status, tags)")
      .eq("profile_id", profileId)
      .eq("status", "visible")
      .order("created_at", { ascending: false }),
    loadTagInfo(db),
  ]);

  type ProRow = { id: string; name: string; logo_url: string | null; status: string; tags: string[] | null };
  const byId = new Map<string, MyPro>();
  for (const v of reacted ?? []) {
    const p = v.pros as unknown as ProRow | null;
    if (!p || p.status !== "active" || byId.has(p.id)) continue;
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      logoUrl: p.logo_url,
      reaction: v.reaction as MyPro["reaction"],
      category: formatTags(p.tags, cats) || null,
      saved: false,
    });
  }
  for (const s of saved ?? []) {
    const p = s.pros as unknown as ProRow | null;
    if (!p || p.status !== "active") continue;
    const existing = byId.get(p.id);
    if (existing) existing.saved = true;
    else byId.set(p.id, { id: p.id, name: p.name, logoUrl: p.logo_url, reaction: null, category: formatTags(p.tags, cats) || null, saved: true });
  }
  return [...byId.values()];
}
