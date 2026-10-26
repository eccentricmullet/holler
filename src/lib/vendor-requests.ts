import type { SupabaseClient } from "@supabase/supabase-js";
import { toE164 } from "@/lib/reactions";
import { cleanSocialUrl } from "@/lib/social";
import { assignProColor } from "@/lib/pro-colors";
import { formatTags, loadTagInfo, mergeTags } from "@/lib/pro-tags";
import type { Alert } from "@/lib/push";
import { SITE } from "@/config/site";

// "Ask us to add a pro": a neighbor who can't add a pro themselves sends what they know;
// the admin creates the pro (or declines) and the neighbor hears back.
export const MAX_VENDOR_REQUESTS_PER_DAY = 3;
export const VENDOR_DETAILS_MAX = 300;

export type VendorRequest = {
  id: string;
  name: string;
  tags: string[];
  tagLine: string;
  details: string | null;
  status: "waiting" | "added" | "declined";
  proId: string | null;
  declineReason: string | null;
  createdAt: string;
  who?: string; // admin view only: "Sarah K."
};

type Row = {
  id: string;
  name: string;
  tags: string[];
  details: string | null;
  status: VendorRequest["status"];
  pro_id: string | null;
  decline_reason: string | null;
  created_at: string;
  profiles?: { first_name: string; last_initial: string } | null;
};

const FIELDS = "id, name, tags, details, status, pro_id, decline_reason, created_at";

function shape(r: Row, cats: Awaited<ReturnType<typeof loadTagInfo>>): VendorRequest {
  return {
    id: r.id,
    name: r.name,
    tags: r.tags ?? [],
    tagLine: formatTags(r.tags, cats, 6),
    details: r.details,
    status: r.status,
    proId: r.pro_id,
    declineReason: r.decline_reason,
    createdAt: r.created_at,
    who: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_initial}.` : undefined,
  };
}

export async function createVendorRequest(
  db: SupabaseClient,
  userId: string,
  input: { name: string; tags: string[]; details?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: me } = await db.from("profiles").select("household_id, banned").eq("id", userId).maybeSingle();
  if (!me?.household_id) return { ok: false, error: "Finish signing up first." };
  if (me.banned) return { ok: false, error: "Your account can't send requests right now." };

  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Add the business or person's name." };
  const tags = mergeTags([], input.tags ?? [], await loadTagInfo(db)).slice(0, 6);
  if (!tags.length) return { ok: false, error: "Pick at least one thing they do." };
  // Only you (the admin) see details, so phone numbers and links are fine here
  const details = (input.details ?? "").trim().replace(/[ \t]+/g, " ").slice(0, VENDOR_DETAILS_MAX) || null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("vendor_requests").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_VENDOR_REQUESTS_PER_DAY) return { ok: false, error: `That's ${MAX_VENDOR_REQUESTS_PER_DAY} requests today. Try again tomorrow.` };

  const { data, error } = await db.from("vendor_requests").insert({ profile_id: userId, name, tags, details }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't send that. Try again." };
  return { ok: true, id: data.id };
}

export async function myVendorRequests(db: SupabaseClient, userId: string): Promise<VendorRequest[]> {
  const [{ data }, cats] = await Promise.all([
    db.from("vendor_requests").select(FIELDS).eq("profile_id", userId).order("created_at", { ascending: false }).limit(20),
    loadTagInfo(db),
  ]);
  return ((data ?? []) as Row[]).map((r) => shape(r, cats));
}

// Admin: waiting requests first (oldest first), then the last few resolved ones
export async function adminVendorRequests(db: SupabaseClient): Promise<{ waiting: VendorRequest[]; recent: VendorRequest[] }> {
  const sel = `${FIELDS}, profiles(first_name, last_initial)`;
  const [{ data: waiting }, { data: recent }, cats] = await Promise.all([
    db.from("vendor_requests").select(sel).eq("status", "waiting").order("created_at", { ascending: true }).limit(100),
    db.from("vendor_requests").select(sel).neq("status", "waiting").order("resolved_at", { ascending: false }).limit(10),
    loadTagInfo(db),
  ]);
  return {
    waiting: ((waiting ?? []) as unknown as Row[]).map((r) => shape(r, cats)),
    recent: ((recent ?? []) as unknown as Row[]).map((r) => shape(r, cats)),
  };
}

export async function waitingVendorRequestCount(db: SupabaseClient) {
  const { count } = await db.from("vendor_requests").select("id", { count: "exact", head: true }).eq("status", "waiting");
  return count ?? 0;
}

// Admin creates the pro from a request (fields can be corrected first), and the request is marked added.
export async function addProFromRequest(
  db: SupabaseClient,
  adminId: string,
  requestId: string,
  input: { name: string; tags: string[]; phone?: string | null; social?: string | null; website?: string | null }
): Promise<{ ok: true; proId: string; requesterId: string } | { ok: false; error: string }> {
  const { data: req } = await db.from("vendor_requests").select("id, profile_id, status").eq("id", requestId).maybeSingle();
  if (!req || req.status !== "waiting") return { ok: false, error: "That request was already handled." };

  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Add a name." };
  const tags = mergeTags([], input.tags, await loadTagInfo(db));
  if (!tags.length) return { ok: false, error: "Pick at least one thing they do." };
  const phone = input.phone?.trim() ? toE164(input.phone) : null;
  if (input.phone?.trim() && !phone) return { ok: false, error: "Check the phone number: it needs 10 digits." };
  const social = input.social?.trim() ? cleanSocialUrl(input.social) : null;
  if (input.social?.trim() && !social) return { ok: false, error: "That doesn't look like an Instagram or Facebook link." };
  const website = input.website?.trim().slice(0, 300) || null;

  const { data: pro, error } = await db
    .from("pros")
    .insert({ name, tags, phone, social_url: social, website, created_by: adminId })
    .select("id")
    .single();
  if (error || !pro) return { ok: false, error: "Couldn't create the pro. Try again." };
  await assignProColor(db, pro.id);
  await db.from("vendor_requests").update({ status: "added", pro_id: pro.id, resolved_at: new Date().toISOString() }).eq("id", requestId);
  return { ok: true, proId: pro.id, requesterId: req.profile_id };
}

export async function declineVendorRequest(db: SupabaseClient, requestId: string, reason: string) {
  const { data, error } = await db
    .from("vendor_requests")
    .update({ status: "declined", decline_reason: reason.trim().slice(0, 120) || null, resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "waiting")
    .select("profile_id")
    .maybeSingle();
  return !error && data ? { ok: true as const, requesterId: data.profile_id as string } : { ok: false as const };
}

// Alerts (opt-in phone alerts). Admins hear about every new request; the neighbor hears when it's added.
export async function adminIds(db: SupabaseClient) {
  const { data } = await db.from("profiles").select("id").eq("role", "admin");
  return (data ?? []).map((p) => p.id as string);
}

export function newRequestAlert(name: string): Alert {
  return { title: "New pro request", body: `A neighbor asked you to add ${name}.`, url: "/admin?tab=requests", tag: "vendor-requests" };
}

export function addedAlert(name: string, proId: string): Alert {
  return { title: `${name} is on ${SITE.name}`, body: "The pro you asked for was added. Give them a 👍 to put them on the map.", url: `/react?pro=${proId}`, tag: `vendor-${proId}` };
}
