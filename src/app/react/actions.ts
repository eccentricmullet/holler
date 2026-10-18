"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessDetails } from "@/lib/places";
import { guessCategory } from "@/lib/guess-category";

export type ProChoice =
  | { kind: "holler"; proId: string }
  | { kind: "google"; placeId: string; sessionToken: string }
  | { kind: "manual"; name: string; phone: string };

export type ReactInput = {
  pro: ProChoice;
  category: string;
  reaction: "thumbs_up" | "love";
  note: string;
};

export type ReactResult =
  | { ok: true; proId: string; proName: string; categoryName: string; reaction: "thumbs_up" | "love"; neighbors: number }
  | { ok: false; error: string };

function toE164(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : null;
}

type Admin = ReturnType<typeof createAdminClient>;

// Finds the pro on Holler, or adds them (once) from Google or the manual form.
async function resolvePro(db: Admin, choice: ProChoice, profileId: string): Promise<{ id: string; name: string } | string> {
  if (choice.kind === "holler") {
    const { data } = await db.from("pros").select("id, name, status, merged_into_id").eq("id", choice.proId).maybeSingle();
    if (!data) return "We couldn't find that pro.";
    if (data.merged_into_id) {
      const { data: into } = await db.from("pros").select("id, name").eq("id", data.merged_into_id).single();
      return into ?? "We couldn't find that pro.";
    }
    if (data.status !== "active") return "That pro isn't available right now.";
    return { id: data.id, name: data.name };
  }

  if (choice.kind === "google") {
    const { data: existing } = await db.from("pros").select("id, name").eq("google_place_id", choice.placeId).maybeSingle();
    if (existing) return existing;
    let biz;
    try {
      biz = await getBusinessDetails(choice.placeId, choice.sessionToken);
    } catch {
      return "We couldn't look up that business. Try again, or add them by name and phone.";
    }
    const { data: created, error } = await db
      .from("pros")
      .insert({
        google_place_id: biz.placeId,
        name: biz.name,
        phone: biz.phone,
        website: biz.website,
        location: biz.lat != null && biz.lng != null ? `SRID=4326;POINT(${biz.lng} ${biz.lat})` : null,
        service_area_text: biz.town,
        created_by: profileId,
      })
      .select("id, name")
      .single();
    if (error?.code === "23505") {
      // Someone added them at the same moment
      const { data: again } = await db.from("pros").select("id, name").eq("google_place_id", choice.placeId).single();
      return again ?? "Something went wrong. Try again.";
    }
    return created ?? "Something went wrong adding that business. Try again.";
  }

  const name = choice.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = toE164(choice.phone);
  if (name.length < 2) return "Add the business name.";
  if (!phone) return "Add their 10-digit phone number.";
  // Same phone number = same business
  const { data: samePhone } = await db.from("pros").select("id, name").eq("phone", phone).eq("status", "active").limit(1);
  if (samePhone?.[0]) return samePhone[0];
  const { data: created } = await db
    .from("pros")
    .insert({ name, phone, created_by: profileId })
    .select("id, name")
    .single();
  return created ?? "Something went wrong adding that business. Try again.";
}

export async function submitReaction(input: ReactInput): Promise<ReactResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, household_id, banned, phone_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.household_id || !profile.phone_verified) return { ok: false, error: "Finish signing up first." };
  if (profile.banned) return { ok: false, error: "Your account can't react right now." };

  if (input.reaction !== "thumbs_up" && input.reaction !== "love") return { ok: false, error: "Pick 👍 or ❤️." };
  const note = input.note.trim().replace(/\s+/g, " ");
  if (note.length > 140) return { ok: false, error: "Keep the note to 140 characters." };

  const { data: category } = await db.from("categories").select("id, name").eq("slug", input.category).maybeSingle();
  if (!category) return { ok: false, error: "Pick a category." };

  const pro = await resolvePro(db, input.pro, profile.id);
  if (typeof pro === "string") return { ok: false, error: pro };

  // One reaction per household per pro per category: reacting again switches it.
  const { error } = await db.from("vouches").upsert(
    {
      household_id: profile.household_id,
      profile_id: profile.id,
      pro_id: pro.id,
      category_id: category.id,
      reaction: input.reaction,
      note: note || null,
      status: "visible",
    },
    { onConflict: "household_id,pro_id,category_id" }
  );
  if (error) return { ok: false, error: "Something went wrong saving that. Try again." };

  const { count } = await db
    .from("vouches")
    .select("id", { count: "exact", head: true })
    .eq("pro_id", pro.id)
    .eq("status", "visible");

  return { ok: true, proId: pro.id, proName: pro.name, categoryName: category.name, reaction: input.reaction, neighbors: count ?? 1 };
}

// Category to preselect for a pro: their most common one, else a guess from the name.
export async function suggestCategory(choice: ProChoice, name: string): Promise<string | null> {
  if (choice.kind === "holler") {
    const db = createAdminClient();
    const { data } = await db.from("vouches").select("categories(slug)").eq("pro_id", choice.proId).limit(200);
    const tally = new Map<string, number>();
    for (const v of data ?? []) {
      const slug = (v.categories as unknown as { slug: string } | null)?.slug;
      if (slug) tally.set(slug, (tally.get(slug) ?? 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) return top;
  }
  return guessCategory(name);
}
