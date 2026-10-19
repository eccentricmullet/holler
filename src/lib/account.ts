import type { SupabaseClient } from "@supabase/supabase-js";

// Removes everything about a user: reactions, flags, Porch posts and photos, profile, login,
// and their home if no one else in the household still has an account.
export async function deleteAccountData(db: SupabaseClient, userId: string): Promise<{ ok: boolean }> {
  const { data: profile } = await db.from("profiles").select("household_id").eq("id", userId).maybeSingle();

  // Porch photos live in file storage, so remove them first (posts go with the profile)
  const { data: photos } = await db.from("porch_posts").select("photo_path").eq("profile_id", userId).not("photo_path", "is", null);
  const paths = (photos ?? []).map((p) => p.photo_path as string);
  if (paths.length) await db.storage.from("porch").remove(paths);

  await db.from("vouches").delete().eq("profile_id", userId);
  await db.from("flags").delete().eq("profile_id", userId);
  await db.from("profiles").delete().eq("id", userId);

  if (profile?.household_id) {
    const { count } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("household_id", profile.household_id);
    if (!count) await db.from("households").delete().eq("id", profile.household_id);
  }

  const { error } = await db.auth.admin.deleteUser(userId);
  return { ok: !error };
}
