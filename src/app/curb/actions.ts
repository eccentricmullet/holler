"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlert } from "@/lib/push";
import { createCurbItem, interestAlert, markGone, reportCurbItem, setInterest } from "@/lib/curb";

async function userId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createCurbItemAction(form: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const uid = await userId();
  if (!uid) return { ok: false, error: "Please sign in first." };
  const files = form.getAll("photos").filter((p): p is File => p instanceof File && p.size > 0);
  const r = await createCurbItem(createAdminClient(), uid, {
    title: String(form.get("title") ?? ""),
    note: String(form.get("note") ?? ""),
    price: Number(form.get("price") ?? 0),
    kind: String(form.get("kind") ?? "other"),
    photos: await Promise.all(files.map(async (f) => ({ bytes: await f.arrayBuffer(), type: f.type }))),
  });
  if (r.ok) revalidatePath("/curb");
  return r;
}

export async function interestAction(itemId: string, on: boolean) {
  const uid = await userId();
  if (!uid) return { ok: false as const, error: "Please sign in first." };
  const db = createAdminClient();
  const r = await setInterest(db, uid, itemId, on);
  // Phone alert to the seller (if they turned alerts on), after the screen has answered
  if (r.ok && r.alert) {
    const { sellerId, title } = r.alert;
    after(() => sendAlert(db, [sellerId], interestAlert(title, itemId)));
  }
  revalidatePath(`/curb/${itemId}`);
  return r.ok ? { ok: true as const } : r;
}

export async function markGoneAction(itemId: string) {
  const uid = await userId();
  if (!uid) return { ok: false };
  const r = await markGone(createAdminClient(), uid, itemId);
  revalidatePath("/curb");
  revalidatePath(`/curb/${itemId}`);
  return r;
}

export async function reportCurbItemAction(itemId: string, reason: string) {
  const uid = await userId();
  if (!uid) return { ok: false, hidden: false };
  const r = await reportCurbItem(createAdminClient(), uid, itemId, reason);
  if (r.hidden) revalidatePath("/curb");
  return r;
}
