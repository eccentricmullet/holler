"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAddressDetails } from "@/lib/places";
import { joinHousehold } from "@/lib/households";

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

  const result = await joinHousehold(createAdminClient(), user.id, place, {
    firstName,
    lastInitial,
    privacy: input.privacy,
  });
  return result.ok ? {} : { error: result.error };
}
