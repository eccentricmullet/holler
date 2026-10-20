import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNote } from "@/lib/note-filter";
import { cleanPrice, cleanTags } from "@/lib/tags";
import { assignProColor } from "@/lib/pro-colors";
import { getBusinessDetails } from "@/lib/places";
import { cleanSocialUrl } from "@/lib/social";
import { MAX_CATEGORIES_PER_REACTION } from "@/lib/limits";

// Trust rules for reacting. The server action passes in the signed-in user; tests pass in test users.
export const MAX_REACTIONS_PER_DAY = 15;
export { MAX_CATEGORIES_PER_REACTION };

export type ProChoice =
  | { kind: "holler"; proId: string }
  | { kind: "google"; placeId: string; sessionToken: string }
  | { kind: "manual"; name: string; phone: string; social?: string }; // phone, or an Instagram/Facebook link

export type ReactInput = {
  pro: ProChoice;
  category: string;
  alsoCategories?: string[]; // more things they do, e.g. lawn + gutters + landscaping (one reaction each)
  reaction: "thumbs_up" | "love";
  note: string;
  tags?: string[]; // optional quick tags (11b)
  price?: number | null; // optional $ / $$ / $$$ (11c)
};

export type ReactResult =
  | { ok: true; proId: string; proName: string; categoryName: string; categoryNames: string[]; reaction: "thumbs_up" | "love"; neighbors: number }
  | { ok: false; error: string };

// inviteProId: the pro whose invite link brought this user here, if any (labels the reaction).
export type Actor = { userId: string; phone: string | null | undefined; inviteProId?: string | null };

export function toE164(input: string | null | undefined) {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

const SELF_REACT = "You can't react to your own business. Ask your customers to!";

type Pro = { id: string; name: string; phone: string | null };

// Finds the pro on Holler, or adds them (once) from Google or the manual form.
async function resolvePro(db: SupabaseClient, choice: ProChoice, actor: Actor): Promise<Pro | string> {
  const own = toE164(actor.phone);

  if (choice.kind === "holler") {
    const { data } = await db
      .from("pros")
      .select("id, name, phone, status, merged_into_id")
      .eq("id", choice.proId)
      .maybeSingle();
    if (!data) return "We couldn't find that pro.";
    if (data.merged_into_id) {
      const { data: into } = await db.from("pros").select("id, name, phone").eq("id", data.merged_into_id).single();
      return into ?? "We couldn't find that pro.";
    }
    if (data.status !== "active") return "That pro isn't available right now.";
    return { id: data.id, name: data.name, phone: data.phone };
  }

  if (choice.kind === "google") {
    const { data: existing } = await db
      .from("pros")
      .select("id, name, phone")
      .eq("google_place_id", choice.placeId)
      .maybeSingle();
    if (existing) return existing;
    let biz;
    try {
      biz = await getBusinessDetails(choice.placeId, choice.sessionToken);
    } catch {
      return "We couldn't look up that business. Try again, or add them by name and phone.";
    }
    if (own && biz.phone === own) return SELF_REACT;
    const { data: created, error } = await db
      .from("pros")
      .insert({
        google_place_id: biz.placeId,
        name: biz.name,
        phone: biz.phone,
        website: biz.website,
        created_by: actor.userId,
      })
      .select("id, name, phone")
      .single();
    if (error?.code === "23505") {
      const { data: again } = await db
        .from("pros")
        .select("id, name, phone")
        .eq("google_place_id", choice.placeId)
        .single();
      return again ?? "Something went wrong. Try again.";
    }
    return created ?? "Something went wrong adding that business. Try again.";
  }

  const name = choice.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = choice.phone?.trim() ? toE164(choice.phone) : null;
  const social = choice.social?.trim() ? cleanSocialUrl(choice.social) : null;
  if (name.length < 2) return "Add the business name.";
  if (choice.phone?.trim() && !phone) return "Check their phone number: it needs 10 digits.";
  if (choice.social?.trim() && !social) return "That link doesn't look like an Instagram or Facebook page.";
  if (!phone && !social) return "Add their phone number, or their Instagram or Facebook.";
  if (own && phone === own) return SELF_REACT;
  // Same phone number, or same Instagram/Facebook page = same business
  for (const [col, val] of [["phone", phone], ["social_url", social]] as const) {
    if (!val) continue;
    const { data: same } = await db.from("pros").select("id, name, phone").eq(col, val).eq("status", "active").limit(1);
    if (same?.[0]) return same[0];
  }
  const { data: created } = await db
    .from("pros")
    .insert({ name, phone, social_url: social, created_by: actor.userId })
    .select("id, name, phone")
    .single();
  return created ?? "Something went wrong adding that business. Try again.";
}

export async function saveReaction(db: SupabaseClient, actor: Actor, input: ReactInput): Promise<ReactResult> {
  const { data: profile } = await db
    .from("profiles")
    .select("id, household_id, banned, phone_verified")
    .eq("id", actor.userId)
    .maybeSingle();
  if (!profile?.household_id || !profile.phone_verified) return { ok: false, error: "Finish signing up first." };
  if (profile.banned) return { ok: false, error: "Your account can't react right now." };

  if (input.reaction !== "thumbs_up" && input.reaction !== "love") return { ok: false, error: "Pick 👍 or ❤️." };
  const note = input.note.trim().replace(/\s+/g, " ");
  const noteCheck = checkNote(note);
  if (!noteCheck.ok) return { ok: false, error: noteCheck.reason };

  const slugs = [...new Set([input.category, ...(input.alsoCategories ?? [])])];
  if (slugs.length > MAX_CATEGORIES_PER_REACTION) {
    return { ok: false, error: `Pick up to ${MAX_CATEGORIES_PER_REACTION} things they do.` };
  }
  const { data: found } = await db.from("categories").select("id, slug, name").in("slug", slugs);
  // Keep the order the neighbor picked them in
  const picked = slugs.map((slug) => found?.find((c) => c.slug === slug));
  if (picked.some((c) => !c)) return { ok: false, error: "Pick a category." };
  const categories = picked as { id: number; slug: string; name: string }[];

  const pro = await resolvePro(db, input.pro, actor);
  if (typeof pro === "string") return { ok: false, error: pro };

  // No self-reacting: the user's verified phone can't match the pro's phone
  const own = toE164(actor.phone);
  if (own && toE164(pro.phone) === own) return { ok: false, error: SELF_REACT };

  // One reaction per household per pro per category: reacting again switches it (doesn't count as new).
  const { data: existing } = await db
    .from("vouches")
    .select("category_id")
    .eq("household_id", profile.household_id)
    .eq("pro_id", pro.id)
    .in("category_id", categories.map((c) => c.id));
  const fresh = categories.filter((c) => !existing?.some((e) => e.category_id === c.id)).length;

  if (fresh > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("vouches")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("created_at", since);
    if ((count ?? 0) + fresh > MAX_REACTIONS_PER_DAY) {
      return { ok: false, error: `That's ${MAX_REACTIONS_PER_DAY} reactions today. Come back tomorrow to add more.` };
    }
  }

  const { error } = await db.from("vouches").upsert(
    categories.map((c) => ({
      household_id: profile.household_id,
      profile_id: profile.id,
      pro_id: pro.id,
      category_id: c.id,
      reaction: input.reaction,
      note: note || null,
      tags: cleanTags(input.tags),
      price: cleanPrice(input.price),
      status: "visible",
      // Reactions that came through the pro's own invite link are labeled internally
      ...(actor.inviteProId && actor.inviteProId === pro.id ? { via_invite: true } : {}),
    })),
    { onConflict: "household_id,pro_id,category_id" }
  );
  if (error) return { ok: false, error: "Something went wrong saving that. Try again." };

  // New pros get their own pin color once we know their category (11j)
  await assignProColor(db, pro.id);

  // Neighbors are homes: one home that picked lawn + gutters still counts once
  const { data: homes } = await db
    .from("vouches")
    .select("household_id")
    .eq("pro_id", pro.id)
    .eq("status", "visible")
    .limit(5000);

  return {
    ok: true,
    proId: pro.id,
    proName: pro.name,
    categoryName: categories[0].name,
    categoryNames: categories.map((c) => c.name),
    reaction: input.reaction,
    neighbors: new Set((homes ?? []).map((h) => h.household_id)).size || 1,
  };
}
