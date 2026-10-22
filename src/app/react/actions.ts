"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE, inviteProId } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { guessCategory } from "@/lib/guess-category";
import { getBusinessPreview, type BusinessPreview } from "@/lib/places";
import { saveReaction, type ProChoice, type ReactInput, type ReactResult } from "@/lib/reactions";

export type { ProChoice, ReactResult };

export async function submitReaction(input: ReactInput): Promise<ReactResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const db = createAdminClient();
  const invitedBy = await inviteProId(db, (await cookies()).get(INVITE_COOKIE)?.value);
  return saveReaction(db, { userId: user.id, phone: user.phone, inviteProId: invitedBy }, input);
}

// Tags to start with: a pro already on Holler keeps its tags (neighbors can add, not remove);
// a new pro gets a guess from its name.
export async function startingTags(choice: ProChoice, name: string): Promise<{ tags: string[]; locked: string[] }> {
  if (choice.kind === "holler") {
    const { data } = await createAdminClient().from("pros").select("tags").eq("id", choice.proId).maybeSingle();
    const tags = (data?.tags ?? []) as string[];
    if (tags.length) return { tags, locked: tags };
  }
  const guess = guessCategory(name);
  return { tags: guess ? [guess] : [], locked: [] };
}

export type PreviewResult =
  | { ok: true; preview: BusinessPreview; suggestedCategory: string | null }
  | { ok: false; error: string };

// "Is this them?": details for the business a neighbor just picked from Google
export async function previewBusiness(placeId: string, sessionToken: string): Promise<PreviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  try {
    const preview = await getBusinessPreview(placeId, sessionToken);
    return { ok: true, preview, suggestedCategory: guessCategory(preview.name, preview.types) };
  } catch {
    return { ok: false, error: "We couldn't look up that business. Try again, or add them by name and phone." };
  }
}
