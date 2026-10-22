"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { answerRecipients, newAskRecipients } from "@/lib/alerts";
import { sendAlert } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerAsk, closeAsk, closeAskWithPro, createAsk, type NewAskInput } from "@/lib/asks";
import { INVITE_COOKIE, inviteProId } from "@/lib/invites";
import type { ProChoice } from "@/lib/reactions";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function createAskAction(input: NewAskInput) {
  const user = await me();
  if (!user) return { ok: false as const, error: "Please sign in first." };
  const db = createAdminClient();
  const r = await createAsk(db, user.id, input);
  revalidatePath("/asks");
  revalidatePath("/porch");
  // Opt-in alert to neighbors whose reach covers the asker (after the screen has answered)
  if (r.ok) {
    const askId = r.askId;
    after(async () => {
      const who = await newAskRecipients(db, askId);
      if (who) await sendAlert(db, who.ids, who.alert);
    });
  }
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
  // Opt-in alert to the person who asked
  if (r.ok) {
    after(async () => {
      const who = await answerRecipients(db, askId);
      if (who) await sendAlert(db, who.ids, who.alert);
    });
  }
  return r;
}

// "Found someone": after reacting to the pro they went with, close the request with that pro
export async function foundSomeoneAction(askId: string, proId: string | null) {
  const user = await me();
  if (!user) return { ok: false as const };
  const r = await closeAskWithPro(createAdminClient(), user.id, askId, proId);
  revalidatePath("/porch");
  revalidatePath("/asks");
  return r;
}

export async function closeAskAction(askId: string) {
  const user = await me();
  if (!user) return;
  await closeAsk(createAdminClient(), user.id, askId);
  revalidatePath("/asks");
  revalidatePath("/porch");
}
