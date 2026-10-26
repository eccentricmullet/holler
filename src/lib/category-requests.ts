import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNote } from "@/lib/note-filter";
import type { Alert } from "@/lib/push";
import { SITE } from "@/config/site";

// "Suggest a service": a neighbor asks for a service that isn't listed;
// the admin adds it as a new category (or declines) and the neighbor hears back.
export const MAX_CATEGORY_REQUESTS_PER_DAY = 3;
export const CATEGORY_NAME_MAX = 40;
export const CATEGORY_DETAILS_MAX = 200;

export type CategoryRequest = {
  id: string;
  name: string;
  details: string | null;
  status: "waiting" | "added" | "declined";
  categorySlug: string | null;
  declineReason: string | null;
  createdAt: string;
  who?: string; // admin view only: "Sarah K."
};

type Row = {
  id: string;
  name: string;
  details: string | null;
  status: CategoryRequest["status"];
  category_slug: string | null;
  decline_reason: string | null;
  created_at: string;
  profiles?: { first_name: string; last_initial: string } | null;
};

const FIELDS = "id, name, details, status, category_slug, decline_reason, created_at";
const tidy = (s: string, max: number) => s.trim().replace(/\s+/g, " ").slice(0, max);

function shape(r: Row): CategoryRequest {
  return {
    id: r.id,
    name: r.name,
    details: r.details,
    status: r.status,
    categorySlug: r.category_slug,
    declineReason: r.decline_reason,
    createdAt: r.created_at,
    who: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_initial}.` : undefined,
  };
}

// "Pressure Washing & Sealing" -> "pressure-washing-and-sealing"
export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function createCategoryRequest(
  db: SupabaseClient,
  userId: string,
  input: { name: string; details?: string | null }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: me } = await db.from("profiles").select("household_id, banned").eq("id", userId).maybeSingle();
  if (!me?.household_id) return { ok: false, error: "Finish signing up first." };
  if (me.banned) return { ok: false, error: "Your account can't send requests right now." };

  const name = tidy(input.name, CATEGORY_NAME_MAX);
  if (name.length < 2) return { ok: false, error: "Type the service you're looking for." };
  const nameCheck = checkNote(name, CATEGORY_NAME_MAX);
  if (!nameCheck.ok) return { ok: false, error: nameCheck.reason };
  const details = tidy(input.details ?? "", CATEGORY_DETAILS_MAX) || null;

  // Already listed? Point them to it instead of sending a request
  const { data: cats } = await db.from("categories").select("slug, name");
  const existing = (cats ?? []).find((c) => c.slug === slugify(name) || c.name.toLowerCase() === name.toLowerCase());
  if (existing) return { ok: false, error: `${existing.name} is already on ${SITE.name}. Look for it in the list.` };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("category_requests").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_CATEGORY_REQUESTS_PER_DAY) return { ok: false, error: `That's ${MAX_CATEGORY_REQUESTS_PER_DAY} requests today. Try again tomorrow.` };

  const { data, error } = await db.from("category_requests").insert({ profile_id: userId, name, details }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't send that. Try again." };
  return { ok: true, id: data.id };
}

export async function myCategoryRequests(db: SupabaseClient, userId: string): Promise<CategoryRequest[]> {
  const { data } = await db.from("category_requests").select(FIELDS).eq("profile_id", userId).order("created_at", { ascending: false }).limit(20);
  return ((data ?? []) as Row[]).map(shape);
}

// Admin: waiting requests first (oldest first), then the last few resolved ones
export async function adminCategoryRequests(db: SupabaseClient): Promise<{ waiting: CategoryRequest[]; recent: CategoryRequest[] }> {
  const sel = `${FIELDS}, profiles(first_name, last_initial)`;
  const [{ data: waiting }, { data: recent }] = await Promise.all([
    db.from("category_requests").select(sel).eq("status", "waiting").order("created_at", { ascending: true }).limit(100),
    db.from("category_requests").select(sel).neq("status", "waiting").order("resolved_at", { ascending: false }).limit(10),
  ]);
  return {
    waiting: ((waiting ?? []) as unknown as Row[]).map(shape),
    recent: ((recent ?? []) as unknown as Row[]).map(shape),
  };
}

export async function waitingCategoryRequestCount(db: SupabaseClient) {
  const { count } = await db.from("category_requests").select("id", { count: "exact", head: true }).eq("status", "waiting");
  return count ?? 0;
}

// The groups shown in the service list (Outside, Inside, Pets, Beauty, …), in list order
export async function categorySections(db: SupabaseClient) {
  const { data } = await db.from("categories").select("section").order("sort_order");
  return [...new Set((data ?? []).map((c) => c.section as string))];
}

// Admin adds the service (name, emoji and group can be fixed up first); it goes at the end of its group.
export async function addCategoryFromRequest(
  db: SupabaseClient,
  requestId: string,
  input: { name: string; icon: string; section: string }
): Promise<{ ok: true; slug: string; name: string; requesterId: string } | { ok: false; error: string }> {
  const { data: req } = await db.from("category_requests").select("id, profile_id, status").eq("id", requestId).maybeSingle();
  if (!req || req.status !== "waiting") return { ok: false, error: "That request was already handled." };

  const name = tidy(input.name, CATEGORY_NAME_MAX);
  const slug = slugify(name);
  if (name.length < 2 || !slug) return { ok: false, error: "Add a name." };
  const icon = input.icon.trim();
  if (!icon || [...icon].length > 8 || /[a-z0-9]/i.test(icon)) return { ok: false, error: "Pick one emoji." };
  const section = tidy(input.section, 30);
  if (!section) return { ok: false, error: "Pick a group." };

  const { data: cats } = await db.from("categories").select("slug, name, section, sort_order").order("sort_order");
  const all = cats ?? [];
  if (all.some((c) => c.slug === slug || c.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `There's already a service called ${name}.` };
  }
  // Slot it in after the last service in its group (or at the very end for a new group), shifting the rest down
  const lastInGroup = all.filter((c) => c.section === section).at(-1);
  const sortOrder = lastInGroup ? lastInGroup.sort_order + 1 : (all.at(-1)?.sort_order ?? 0) + 1;
  for (const c of all.filter((c) => c.sort_order >= sortOrder).reverse()) {
    await db.from("categories").update({ sort_order: c.sort_order + 1 }).eq("slug", c.slug);
  }

  const { error } = await db.from("categories").insert({ slug, name, icon, section, sort_order: sortOrder });
  if (error) return { ok: false, error: "Couldn't add the service. Try again." };
  await db.from("category_requests").update({ status: "added", category_slug: slug, resolved_at: new Date().toISOString() }).eq("id", requestId);
  return { ok: true, slug, name, requesterId: req.profile_id };
}

export async function declineCategoryRequest(db: SupabaseClient, requestId: string, reason: string) {
  const { data, error } = await db
    .from("category_requests")
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
  return { title: "New service request", body: `A neighbor asked for “${name}”.`, url: "/admin?tab=requests", tag: "category-requests" };
}

export function addedAlert(name: string, slug: string): Alert {
  return {
    title: `${name} is on ${SITE.name}`,
    body: "The service you asked for was added. Know someone good? Recommend them.",
    url: `/react?category=${slug}`,
    tag: `category-${slug}`,
  };
}
