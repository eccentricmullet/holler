"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { joinWaitlist, type WaitlistInput, type WaitlistResult } from "@/lib/waitlist";

export async function joinWaitlistAction(input: WaitlistInput): Promise<WaitlistResult> {
  return joinWaitlist(createAdminClient(), input);
}
