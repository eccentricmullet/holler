import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNote } from "@/lib/note-filter";
import { cleanPrice, cleanTags } from "@/lib/tags";
import { getBusinessDetails } from "@/lib/places";

// Trust rules for reacting. The server action passes in the signed-in user; tests pass in test users.
export const MAX_REACTIONS_PER_DAY = 15;

export type ProChoice =
  | { kind: "holler"; proId: string }
  | { kind: "google"; placeId: string; sessionToken: string }
  | { kind: "manual"; name: string; phone: string };

export type ReactInput = {
  pro: ProChoice;
  category: string;
  reaction: "thumbs_up" | "love";
  note: string;
  tags?: string[]; // optional quick tags (11b)
  price?: number | null; // optional $ / $$ / $$$ (11c)
};

export type ReactResult =
  | { ok: true; proId: string; proName: string; categoryName: string; reaction: "thumbs_up" | "love"; neighbors: number }
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
        location: biz.lat != null && biz.lng != null ? `SRID=4326;POINT(${biz.lng} ${biz.lat})` : null,
        service_area_text: biz.town,
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
  const phone = toE164(choice.phone);
  if (name.length < 2) return "Add the business name.";
  if (!phone) return "Add their 10-digit phone number.";
  if (own && phone === own) return SELF_REACT;
  // Same phone number = same business
  const { data: samePhone } = await db
    .from("pros")
    .select("id, name, phone")
    .eq("phone", phone)
    .eq("status", "active")
    .limit(1);
  if (samePhone?.[0]) return samePhone[0];
  const { data: created } = await db
    .from("pros")
    .insert({ name, phone, created_by: actor.userId })
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

  const { data: category } = await db.from("categories").select("id, name").eq("slug", input.category).maybeSingle();
  if (!category) return { ok: false, error: "Pick a category." };

  const pro = await resolvePro(db, input.pro, actor);
  if (typeof pro === "string") return { ok: false, error: pro };

  // No self-reacting: the user's verified phone can't match the pro's phone
  const own = toE164(actor.phone);
  if (own && toE164(pro.phone) === own) return { ok: false, error: SELF_REACT };

  // One reaction per household per pro per category: reacting again switches it (doesn't count as new).
  const { data: existing } = await db
    .from("vouches")
    .select("id")
    .eq("household_id", profile.household_id)
    .eq("pro_id", pro.id)
    .eq("category_id", category.id)
    .maybeSingle();

  if (!existing) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("vouches")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_REACTIONS_PER_DAY) {
      return { ok: false, error: `That's ${MAX_REACTIONS_PER_DAY} reactions today. Come back tomorrow to add more.` };
    }
  }

  const { error } = await db.from("vouches").upsert(
    {
      household_id: profile.household_id,
      profile_id: profile.id,
      pro_id: pro.id,
      category_id: category.id,
      reaction: input.reaction,
      note: note || null,
      tags: cleanTags(input.tags),
      price: cleanPrice(input.price),
      status: "visible",
      // Reactions that came through the pro's own invite link are labeled internally
      ...(actor.inviteProId && actor.inviteProId === pro.id ? { via_invite: true } : {}),
    },
    { onConflict: "household_id,pro_id,category_id" }
  );
  if (error) return { ok: false, error: "Something went wrong saving that. Try again." };

  const { count } = await db
    .from("vouches")
    .select("id", { count: "exact", head: true })
    .eq("pro_id", pro.id)
    .eq("status", "visible");

  return {
    ok: true,
    proId: pro.id,
    proName: pro.name,
    categoryName: category.name,
    reaction: input.reaction,
    neighbors: count ?? 1,
  };
}
