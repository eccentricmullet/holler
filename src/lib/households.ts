import type { SupabaseClient } from "@supabase/supabase-js";

// Trust rule: at most this many accounts can share one address.
export const MAX_ACCOUNTS_PER_HOME = 3;

export type HomePlace = { placeId: string; address: string; lat: number; lng: number; neighborhood: string | null };

// Finds the household for this address (or creates it) and adds the profile to it.
export async function joinHousehold(
  db: SupabaseClient,
  userId: string,
  place: HomePlace,
  person: { firstName: string; lastInitial: string; privacy: "block" | "hidden" }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existingProfile } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existingProfile) return { ok: true };

  let { data: household } = await db.from("households").select("id").eq("address_place_id", place.placeId).maybeSingle();

  if (household) {
    const { count } = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id);
    if ((count ?? 0) >= MAX_ACCOUNTS_PER_HOME) {
      return { ok: false, error: "This home already has the most accounts allowed. Reach out if that's a mistake." };
    }
  } else {
    const { data: created, error } = await db
      .from("households")
      .insert({
        address: place.address,
        address_place_id: place.placeId,
        location: `SRID=4326;POINT(${place.lng} ${place.lat})`,
        neighborhood: place.neighborhood,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      // Someone else in the home signed up at the same moment; join theirs.
      ({ data: household } = await db.from("households").select("id").eq("address_place_id", place.placeId).single());
    } else if (error || !created) {
      return { ok: false, error: "Something went wrong saving your home. Try again." };
    } else {
      household = created;
    }
    if (!household) return { ok: false, error: "Something went wrong saving your home. Try again." };
  }

  const { error: profileError } = await db.from("profiles").insert({
    id: userId,
    household_id: household.id,
    first_name: person.firstName,
    last_initial: person.lastInitial,
    phone_verified: true,
    privacy: person.privacy,
  });
  if (profileError) return { ok: false, error: "Something went wrong creating your account. Try again." };
  return { ok: true };
}
