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

// Category to preselect for a pro: their most common one, else a guess from the name.
export async function suggestCategory(choice: ProChoice, name: string): Promise<string | null> {
  if (choice.kind === "holler") {
    const db = createAdminClient();
    const { data } = await db.from("vouches").select("categories(slug)").eq("pro_id", choice.proId).limit(200);
    const tally = new Map<string, number>();
    for (const v of data ?? []) {
      const slug = (v.categories as unknown as { slug: string } | null)?.slug;
      if (slug) tally.set(slug, (tally.get(slug) ?? 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) return top;
  }
  return guessCategory(name);
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
