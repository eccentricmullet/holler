import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { metersBetween, ONE_MILE_M, parsePoint } from "@/lib/geo";
import { TAGS } from "@/lib/tags";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProNote = {
  vouchId: string;
  reaction: "thumbs_up" | "love";
  note: string;
  byline: string; // "Sarah K. · Wades Grove" or "A neighbor"
};

export type ProPage = {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  thumbs: number;
  love: number;
  nearCustomers: number;
  notes: ProNote[];
  tagCounts: { id: string; label: string; emoji: string; count: number }[]; // most-said first
  price: { level: 1 | 2 | 3; from: number } | null; // typical price, from N neighbors
};

export type ProLookup = { kind: "found"; pro: ProPage } | { kind: "merged"; into: string } | { kind: "missing" };

type VouchRow = {
  id: string;
  reaction: "thumbs_up" | "love";
  note: string | null;
  tags?: string[] | null;
  price?: number | null;
  created_at: string;
  household_id: string;
  categories: { slug: string; name: string } | null;
  profiles: { first_name: string; last_initial: string; privacy: string; banned: boolean } | null;
  households: { neighborhood: string | null; display_location: unknown } | null;
};

// Everything the pro page and its link preview show. Runs on the server with full access,
// and returns only public info: counts, first name + last initial, neighborhood.
export const getProPage = cache(async (id: string, near: { lat: number; lng: number }): Promise<ProLookup> => {
  if (!UUID.test(id)) return { kind: "missing" };
  const db = createAdminClient();

  const { data: pro } = await db
    .from("pros")
    .select("id, name, phone, website, logo_url, status, merged_into_id")
    .eq("id", id)
    .maybeSingle();
  if (!pro) return { kind: "missing" };
  if (pro.merged_into_id) return { kind: "merged", into: pro.merged_into_id };
  if (pro.status !== "active") return { kind: "missing" };

  const { data } = await db
    .from("vouches")
    .select(
      "*, categories(slug, name), profiles(first_name, last_initial, privacy, banned), households(neighborhood, display_location)"
    )
    .eq("pro_id", id)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = ((data ?? []) as unknown as VouchRow[]).filter((r) => r.profiles && !r.profiles.banned);

  // The category most neighbors use this pro for
  const tally = new Map<string, { slug: string; name: string; n: number }>();
  for (const r of rows) {
    if (!r.categories) continue;
    const t = tally.get(r.categories.slug) ?? { ...r.categories, n: 0 };
    t.n++;
    tally.set(t.slug, t);
  }
  const top = [...tally.values()].sort((a, b) => b.n - a.n)[0] ?? null;

  const nearHomes = new Set<string>();
  for (const r of rows) {
    const p = parsePoint(r.households?.display_location);
    if (p && metersBetween(p, near) <= ONE_MILE_M) nearHomes.add(r.household_id);
  }

  const notes: ProNote[] = rows
    .filter((r) => r.note)
    .slice(0, 30)
    .map((r) => {
      const p = r.profiles!;
      const hidden = p.privacy === "hidden";
      const who = hidden ? "A neighbor" : `${p.first_name} ${p.last_initial}.`;
      const hood = r.households?.neighborhood;
      return { vouchId: r.id, reaction: r.reaction, note: r.note!, byline: hood && !hidden ? `${who} · ${hood}` : who };
    });

  // 11b: how many neighbors picked each quick tag, most-said first
  const tagCounts = TAGS.map((t) => ({ ...t, count: rows.filter((r) => r.tags?.includes(t.id)).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  // 11c: typical price = the middle answer among neighbors who gave one
  const prices = rows.map((r) => r.price).filter((p): p is number => p === 1 || p === 2 || p === 3).sort();
  const price = prices.length ? { level: prices[Math.floor((prices.length - 1) / 2)] as 1 | 2 | 3, from: prices.length } : null;

  return {
    kind: "found",
    pro: {
      id: pro.id,
      name: pro.name,
      phone: pro.phone,
      website: pro.website,
      logoUrl: pro.logo_url,
      categoryName: top?.name ?? null,
      categorySlug: top?.slug ?? null,
      thumbs: rows.filter((r) => r.reaction === "thumbs_up").length,
      love: rows.filter((r) => r.reaction === "love").length,
      nearCustomers: nearHomes.size,
      notes,
      tagCounts,
      price,
    },
  };
});

// Where "within 1 mile" is measured from: the signed-in user's block, else the launch town.
export async function viewerCenter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fallback: { lat: number; lng: number }
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return fallback;
  const { data } = await supabase
    .rpc("my_home")
    .maybeSingle<{ home_lat: number | null; home_lng: number | null }>();
  return data?.home_lat != null && data.home_lng != null ? { lat: data.home_lat, lng: data.home_lng } : fallback;
}
