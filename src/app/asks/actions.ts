"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerAsk, closeAsk, createAsk } from "@/lib/asks";
import { INVITE_COOKIE, inviteProId } from "@/lib/invites";
import type { ProChoice } from "@/lib/reactions";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function createAskAction(categorySlug: string) {
  const user = await me();
  if (!user) return { ok: false as const, error: "Please sign in first." };
  const r = await createAsk(createAdminClient(), user.id, categorySlug);
  revalidatePath("/asks");
  return r;
}

export async function answerAskAction(
  askId: string,
  input: { pro: ProChoice; reaction: "thumbs_up" | "love"; note: string; tags?: string[]; price?: number | null }
) {
  const user = await me();
  if (!user) return { ok: false as const, error: "Please sign in first." };
  const db = createAdminClient();
  const invitedBy = await inviteProId(db, (await cookies()).get(INVITE_COOKIE)?.value);
  const r = await answerAsk(db, { userId: user.id, phone: user.phone, inviteProId: invitedBy }, askId, input);
  revalidatePath("/asks");
  return r;
}

export async function closeAskAction(askId: string) {
  const user = await me();
  if (!user) return;
  await closeAsk(createAdminClient(), user.id, askId);
  revalidatePath("/asks");
}
