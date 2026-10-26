"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hideUserReactions, mergePros, setBanned } from "@/lib/admin";
import { toE164 } from "@/lib/reactions";
import { cleanSocialUrl } from "@/lib/social";
import { loadTagInfo, mergeTags } from "@/lib/pro-tags";
import { getOrCreateInvite } from "@/lib/invites";
import { after } from "next/server";
import { sendAlert } from "@/lib/push";
import { addedAlert, addProFromRequest, declineVendorRequest } from "@/lib/vendor-requests";

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
  const socialRaw = str(form, "social");
  const social = socialRaw ? cleanSocialUrl(socialRaw) : null;
  // Service tags: keep the current order for ones still checked, new ones on the end
  const picked = form.getAll("tags").map(String);
  const { data: before } = await db.from("pros").select("tags").eq("id", id).maybeSingle();
  const current = ((before?.tags ?? []) as string[]).filter((t) => picked.includes(t));
  const tags = mergeTags(current, picked, await loadTagInfo(db));
  if (name.length < 2 || (phoneRaw && !phone) || (socialRaw && !social)) redirect(`/admin/pros/${id}?error=check`);
  if (!tags.length) redirect(`/admin/pros/${id}?error=tags`);
  await db
    .from("pros")
    .update({ name, phone, website: website || null, social_url: social, tags })
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

// Vendor requests ("Ask us to add a pro"): create the pro from a request, or decline it.
async function requireAdminId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const db = await requireAdmin();
  return { db, adminId: user!.id };
}

export async function addProFromRequestAction(form: FormData) {
  const { db, adminId } = await requireAdminId();
  const requestId = str(form, "requestId");
  const name = str(form, "name");
  const r = await addProFromRequest(db, adminId, requestId, {
    name,
    tags: form.getAll("tags").map(String),
    phone: str(form, "phone"),
    social: str(form, "social"),
    website: str(form, "website"),
  });
  if (!r.ok) redirect(`/admin/requests/${requestId}?error=${encodeURIComponent(r.error)}`);
  const { proId, requesterId } = r;
  after(() => sendAlert(db, [requesterId], addedAlert(name, proId)));
  revalidatePath("/admin");
  redirect(`/admin?tab=requests&added=${encodeURIComponent(name)}`);
}

export async function declineVendorRequestAction(form: FormData) {
  const { db } = await requireAdminId();
  await declineVendorRequest(db, str(form, "requestId"), str(form, "reason"));
  revalidatePath("/admin");
  redirect("/admin?tab=requests");
}
