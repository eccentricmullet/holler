import type { SupabaseClient } from "@supabase/supabase-js";

// Admin-only operations. Callers must check the user is an admin first.

export const FLAG_ALERT_THRESHOLD = 3;

// Merges a duplicate pro into the one to keep. Reactions, flags and invites move over;
// if a home reacted to both in the same category, the kept pro's reaction wins.
export async function mergePros(db: SupabaseClient, sourceId: string, targetId: string): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  if (sourceId === targetId) return { ok: false, error: "Pick two different pros." };
  const { data: pros } = await db
    .from("pros")
    .select("id, name, phone, website, social_url, logo_url, google_place_id, merged_into_id")
    .in("id", [sourceId, targetId]);
  const source = pros?.find((p) => p.id === sourceId);
  const target = pros?.find((p) => p.id === targetId);
  if (!source || !target) return { ok: false, error: "Couldn't find both pros." };
  if (target.merged_into_id) return { ok: false, error: "The pro to keep was already merged into another one." };

  const [{ data: sourceVouches }, { data: targetVouches }] = await Promise.all([
    db.from("vouches").select("id, household_id, category_id").eq("pro_id", sourceId),
    db.from("vouches").select("household_id, category_id").eq("pro_id", targetId),
  ]);
  const taken = new Set((targetVouches ?? []).map((v) => `${v.household_id}:${v.category_id}`));
  const clash = (sourceVouches ?? []).filter((v) => taken.has(`${v.household_id}:${v.category_id}`)).map((v) => v.id);
  const move = (sourceVouches ?? []).filter((v) => !taken.has(`${v.household_id}:${v.category_id}`)).map((v) => v.id);

  if (clash.length) await db.from("vouches").delete().in("id", clash);
  if (move.length) {
    const { error } = await db.from("vouches").update({ pro_id: targetId }).in("id", move);
    if (error) return { ok: false, error: "Couldn't move the reactions. Nothing else was changed." };
  }
  await db.from("flags").update({ pro_id: targetId }).eq("pro_id", sourceId);
  await db.from("invites").update({ pro_id: targetId }).eq("pro_id", sourceId);
  await db.from("pros").update({ merged_into_id: targetId }).eq("merged_into_id", sourceId);

  // Keep the best details: fill gaps on the kept pro from the duplicate
  const fill: Record<string, string> = {};
  if (!target.phone && source.phone) fill.phone = source.phone;
  if (!target.website && source.website) fill.website = source.website;
  if (!target.social_url && source.social_url) fill.social_url = source.social_url;
  if (!target.logo_url && source.logo_url) fill.logo_url = source.logo_url;
  const movePlace = !target.google_place_id && source.google_place_id;

  const { error: hideErr } = await db
    .from("pros")
    .update({ merged_into_id: targetId, status: "hidden", ...(movePlace ? { google_place_id: null } : {}) })
    .eq("id", sourceId);
  if (hideErr) return { ok: false, error: "Moved the reactions but couldn't hide the duplicate. Try again." };
  if (movePlace) fill.google_place_id = source.google_place_id;
  if (Object.keys(fill).length) await db.from("pros").update(fill).eq("id", targetId);

  return { ok: true, moved: move.length };
}

export async function hideUserReactions(db: SupabaseClient, profileId: string, hidden: boolean) {
  return db.from("vouches").update({ status: hidden ? "hidden" : "visible" }).eq("profile_id", profileId);
}

export async function setBanned(db: SupabaseClient, profileId: string, banned: boolean) {
  return db.from("profiles").update({ banned }).eq("id", profileId).neq("role", "admin");
}

export type QueueFlag = {
  id: string;
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: string;
  pro: { id: string; name: string } | null;
  note: { id: string; text: string; status: string; author: string; authorId: string } | null;
};

export async function openFlags(db: SupabaseClient): Promise<QueueFlag[]> {
  const { data } = await db
    .from("flags")
    .select(
      "id, reason, details, created_at, reporter:profiles!flags_profile_id_fkey(first_name, last_initial), pros(id, name), vouches(id, note, status, pro_id, author:profiles!vouches_profile_id_fkey(id, first_name, last_initial), pros(id, name))"
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);

  type Row = {
    id: string;
    reason: string;
    details: string | null;
    created_at: string;
    reporter: { first_name: string; last_initial: string } | null;
    pros: { id: string; name: string } | null;
    vouches: {
      id: string;
      note: string | null;
      status: string;
      author: { id: string; first_name: string; last_initial: string } | null;
      pros: { id: string; name: string } | null;
    } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((f) => ({
    id: f.id,
    reason: f.reason,
    details: f.details,
    createdAt: f.created_at,
    reporter: f.reporter ? `${f.reporter.first_name} ${f.reporter.last_initial}.` : "Deleted user",
    pro: f.pros ?? f.vouches?.pros ?? null,
    note: f.vouches
      ? {
          id: f.vouches.id,
          text: f.vouches.note ?? "",
          status: f.vouches.status,
          author: f.vouches.author ? `${f.vouches.author.first_name} ${f.vouches.author.last_initial}.` : "Deleted user",
          authorId: f.vouches.author?.id ?? "",
        }
      : null,
  }));
}
