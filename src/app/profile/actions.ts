"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkNote } from "@/lib/note-filter";
import { deleteAccountData } from "@/lib/account";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function signOut() {
  const { supabase } = await currentUser();
  await supabase.auth.signOut();
  redirect("/");
}

// Name and map privacy. Runs as the user, so the database only lets them change their own row.
export async function updateDetails(input: {
  firstName: string;
  lastInitial: string;
  privacy: "block" | "hidden";
}): Promise<{ error?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please sign in first." };
  const firstName = input.firstName.trim().slice(0, 40);
  const lastInitial = input.lastInitial.trim().charAt(0).toUpperCase();
  if (!firstName || !/^[A-Z]$/.test(lastInitial)) return { error: "Add your first name and last initial." };
  if (input.privacy !== "block" && input.privacy !== "hidden") return { error: "Pick how you show on the map." };
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: firstName, last_initial: lastInitial, privacy: input.privacy })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save that. Try again." };
  revalidatePath("/profile");
  revalidatePath("/");
  return {};
}

// Switch 👍/❤️ or remove one of your own reactions (the database checks it's yours).
export async function setReaction(vouchId: string, reaction: "thumbs_up" | "love"): Promise<{ error?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please sign in first." };
  if (reaction !== "thumbs_up" && reaction !== "love") return { error: "Pick 👍 or ❤️." };
  const { error, count } = await supabase
    .from("vouches")
    .update({ reaction }, { count: "exact" })
    .eq("id", vouchId)
    .eq("profile_id", user.id);
  if (error || !count) return { error: "Couldn't change that. Try again." };
  revalidatePath("/profile/reactions");
  return {};
}

export async function setNote(vouchId: string, note: string): Promise<{ error?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please sign in first." };
  const clean = note.trim().replace(/\s+/g, " ");
  const check = checkNote(clean);
  if (!check.ok) return { error: check.reason };
  const { error, count } = await supabase
    .from("vouches")
    .update({ note: clean || null }, { count: "exact" })
    .eq("id", vouchId)
    .eq("profile_id", user.id);
  if (error || !count) return { error: "Couldn't save that. Try again." };
  revalidatePath("/profile/reactions");
  return {};
}

export async function removeReaction(vouchId: string): Promise<{ error?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please sign in first." };
  const { error, count } = await supabase
    .from("vouches")
    .delete({ count: "exact" })
    .eq("id", vouchId)
    .eq("profile_id", user.id);
  if (error || !count) return { error: "Couldn't remove that. Try again." };
  revalidatePath("/profile/reactions");
  revalidatePath("/profile");
  return {};
}

// Deletes the account right away: reactions, flags, profile, login, and the home if no one else uses it.
export async function deleteAccount(confirmation: string): Promise<{ error?: string }> {
  const { supabase, user } = await currentUser();
  if (!user) return { error: "Please sign in first." };
  if (confirmation.trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };

  const { ok } = await deleteAccountData(createAdminClient(), user.id);
  if (!ok) return { error: "Your reactions were removed, but we couldn't finish deleting the login. Try again." };

  await supabase.auth.signOut();
  redirect("/");
}
