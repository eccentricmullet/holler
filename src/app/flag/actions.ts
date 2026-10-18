"use server";

import { createClient } from "@/lib/supabase/server";
import { NOTE_REASONS, PRO_REASONS } from "./reasons";

// Files a private flag as the signed-in user (the database only lets them file as themselves).
export async function fileFlag(input: {
  kind: "pro" | "note";
  id: string;
  reason: string;
  details: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in first." };
  const reasons = input.kind === "pro" ? PRO_REASONS : NOTE_REASONS;
  if (!reasons.includes(input.reason)) return { error: "Pick a reason." };
  const details = input.details.trim().slice(0, 1000);

  const { error } = await supabase.from("flags").insert({
    pro_id: input.kind === "pro" ? input.id : null,
    vouch_id: input.kind === "note" ? input.id : null,
    reason: input.reason,
    details: details || null,
  });
  if (error) return { error: "Couldn't send that. Try again." };
  return {};
}
