"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hideUserReactions, mergePros, setBanned } from "@/lib/admin";
import { toE164 } from "@/lib/reactions";
import { getOrCreateInvite } from "@/lib/invites";

// Every admin action checks, on the server, that the signed-in user is an admin.
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/admin");
  const db = createAdminClient();
  const { data: me } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/");
  return db;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function resolveFlag(form: FormData) {
  const db = await requireAdmin();
  const flagId = str(form, "flagId");
  const also = str(form, "also"); // "hide-note" | "hide-pro" | ""
  const { data: flag } = await db.from("flags").select("id, pro_id, vouch_id").eq("id", flagId).maybeSingle();
  if (!flag) return;
  if (also === "hide-note" && flag.vouch_id) await db.from("vouches").update({ status: "hidden" }).eq("id", flag.vouch_id);
  if (also === "hide-pro" && flag.pro_id) await db.from("pros").update({ status: "hidden" }).eq("id", flag.pro_id);
  await db.from("flags").update({ status: "resolved" }).eq("id", flagId);
  revalidatePath("/admin");
}

export async function updatePro(form: FormData) {
  const db = await requireAdmin();
  const id = str(form, "proId");
  const name = str(form, "name").slice(0, 80);
  const phoneRaw = str(form, "phone");
  const website = str(form, "website").slice(0, 300);
  const phone = phoneRaw ? toE164(phoneRaw) : null;
  if (name.length < 2 || (phoneRaw && !phone)) redirect(`/admin/pros/${id}?error=check`);
  await db
    .from("pros")
    .update({ name, phone, website: website || null })
    .eq("id", id);
  revalidatePath(`/admin/pros/${id}`);
  redirect(`/admin/pros/${id}?saved=1`);
}

export async function setProStatus(form: FormData) {
  const db = await requireAdmin();
  const id = str(form, "proId");
  const status = str(form, "status") === "hidden" ? "hidden" : "active";
  await db.from("pros").update({ status }).eq("id", id);
  revalidatePath(`/admin/pros/${id}`);
  revalidatePath("/admin");
}

export async function mergeProsAction(form: FormData) {
  const db = await requireAdmin();
  const source = str(form, "sourceId");
  const target = str(form, "targetId");
  const r = await mergePros(db, source, target);
  revalidatePath("/admin");
  if (!r.ok) redirect(`/admin/pros/${source}?error=${encodeURIComponent(r.error)}`);
  redirect(`/admin/pros/${target}?merged=${r.moved}`);
}

export async function setUserReactionsHidden(form: FormData) {
  const db = await requireAdmin();
  await hideUserReactions(db, str(form, "profileId"), str(form, "hidden") === "1");
  revalidatePath("/admin");
}

export async function setUserBanned(form: FormData) {
  const db = await requireAdmin();
  await setBanned(db, str(form, "profileId"), str(form, "banned") === "1");
  revalidatePath("/admin");
}

export async function createInviteAction(form: FormData) {
  const db = await requireAdmin();
  const proId = str(form, "proId");
  await getOrCreateInvite(db, proId);
  revalidatePath(`/admin/pros/${proId}`);
}
