"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPost, deletePost, markDone, reactToPost, reportPost, toggleAction } from "@/lib/porch";

async function userId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createPostAction(form: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const uid = await userId();
  if (!uid) return { ok: false, error: "Please sign in first." };
  const photo = form.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  const r = await createPost(createAdminClient(), uid, {
    kind: String(form.get("kind") ?? ""),
    body: String(form.get("body") ?? ""),
    topic: (form.get("topic") as string) || null,
    happensOn: (form.get("happensOn") as string) || null,
    proId: (form.get("proId") as string) || null,
    photo: file ? { bytes: await file.arrayBuffer(), type: file.type } : null,
  });
  revalidatePath("/porch");
  return r.ok ? { ok: true } : r;
}

export async function reactAction(postId: string, reaction: "thumbs_up" | "love" | null) {
  const uid = await userId();
  if (!uid) return { ok: false };
  return reactToPost(createAdminClient(), uid, postId, reaction);
}

export async function oneTapAction(postId: string, on: boolean) {
  const uid = await userId();
  if (!uid) return { ok: false };
  return toggleAction(createAdminClient(), uid, postId, on);
}

export async function markDoneAction(postId: string) {
  const uid = await userId();
  if (!uid) return { ok: false };
  const r = await markDone(createAdminClient(), uid, postId);
  revalidatePath("/porch");
  return r;
}

export async function deletePostAction(postId: string) {
  const uid = await userId();
  if (!uid) return { ok: false };
  const r = await deletePost(createAdminClient(), uid, postId);
  revalidatePath("/porch");
  return r;
}

export async function reportPostAction(postId: string, reason: string) {
  const uid = await userId();
  if (!uid) return { ok: false, hidden: false };
  return reportPost(createAdminClient(), uid, postId, reason);
}
