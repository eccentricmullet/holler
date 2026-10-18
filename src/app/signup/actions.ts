"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAddressDetails } from "@/lib/places";

const MAX_ACCOUNTS_PER_HOME = 3;

type Input = {
  firstName: string;
  lastInitial: string;
  placeId: string;
  sessionToken: string;
  privacy: "block" | "hidden";
};

// Finishes sign-up: finds or creates the household, then creates the profile.
// Runs on the server; the exact address and location never go back to the browser.
export async function completeSignup(input: Input): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.phone_confirmed_at) return { error: "Please verify your phone number first." };

  const firstName = input.firstName.trim().slice(0, 40);
  const lastInitial = input.lastInitial.trim().charAt(0).toUpperCase();
  if (!firstName || !/^[A-Z]$/.test(lastInitial)) return { error: "Add your first name and last initial." };
  if (input.privacy !== "block" && input.privacy !== "hidden") return { error: "Pick how you show on the map." };
  if (!input.placeId) return { error: "Pick your address from the list." };

  let place;
  try {
    place = await getAddressDetails(input.placeId, input.sessionToken);
  } catch {
    return { error: "We couldn't look up that address. Try again." };
  }

  const admin = createAdminClient();

  const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existingProfile) return {};

  let { data: household } = await admin
    .from("households")
    .select("id")
    .eq("address_place_id", place.placeId)
    .maybeSingle();

  if (household) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id);
    if ((count ?? 0) >= MAX_ACCOUNTS_PER_HOME) {
      return { error: "This home already has the most accounts allowed. Reach out if that's a mistake." };
    }
  } else {
    const { data: created, error } = await admin
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
      ({ data: household } = await admin
        .from("households")
        .select("id")
        .eq("address_place_id", place.placeId)
        .single());
    } else if (error || !created) {
      return { error: "Something went wrong saving your home. Try again." };
    } else {
      household = created;
    }
    if (!household) return { error: "Something went wrong saving your home. Try again." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    household_id: household.id,
    first_name: firstName,
    last_initial: lastInitial,
    phone_verified: true,
    privacy: input.privacy,
  });
  if (profileError) return { error: "Something went wrong creating your account. Try again." };

  return {};
}
