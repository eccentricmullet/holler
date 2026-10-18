"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Save or unsave a pro for the signed-in user (the database only lets them change their own list).
export async function toggleSaved(proId: string, save: boolean): Promise<{ ok: boolean; needsSignIn?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsSignIn: true };
  const { error } = save
    ? await supabase.from("saved_pros").upsert({ profile_id: user.id, pro_id: proId }, { onConflict: "profile_id,pro_id" })
    : await supabase.from("saved_pros").delete().eq("profile_id", user.id).eq("pro_id", proId);
  revalidatePath("/profile/pros");
  return { ok: !error };
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// The code for the user's public "My pros" page; made the first time they tap Share.
export async function getShareCode(): Promise<{ code?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };
  const db = createAdminClient();
  const { data: me } = await db.from("profiles").select("share_code").eq("id", user.id).single();
  if (me?.share_code) return { code: me.share_code };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join("");
    const { error } = await db.from("profiles").update({ share_code: code }).eq("id", user.id);
    if (!error) return { code };
    if (error.code !== "23505") break;
  }
  return { error: "Couldn't make a link. Try again." };
}
