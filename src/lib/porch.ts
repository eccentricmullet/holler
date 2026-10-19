import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNote } from "@/lib/note-filter";
import { metersBetween, parsePoint } from "@/lib/geo";
import { whenLabel } from "@/lib/recency";
import { asksNear } from "@/lib/asks";
import { reachMeters } from "@/lib/reach";
import { HEADS_UP_TOPICS, KINDS, isKind, type PorchKind, type PorchTab } from "@/lib/porch-kinds";

// The Porch (11k): a neighborhood board that runs itself. Everything goes through the server.
export const MAX_POSTS_PER_DAY = 5;
export const REPORTS_TO_HIDE = 3; // from different homes
export const POST_MAX = 280;
export const PORCH_BUCKET = "porch";

type Me = { id: string; household_id: string | null; banned: boolean; first_name: string; last_initial: string; privacy: string; reach_miles: number | null };

async function me(db: SupabaseClient, userId: string) {
  const { data } = await db.from("profiles").select("id, household_id, banned, first_name, last_initial, privacy, reach_miles").eq("id", userId).maybeSingle();
  return data as Me | null;
}

async function homePoint(db: SupabaseClient, householdId: string) {
  const { data } = await db.from("households").select("display_location").eq("id", householdId).single();
  return parsePoint(data?.display_location);
}

function expiryFor(kind: PorchKind, happensOn: string | null) {
  const info = KINDS[kind];
  if (info.needsDate && happensOn) {
    const d = new Date(`${happensOn}T23:59:59`);
    d.setDate(d.getDate() + 1); // gone the day after
    return d.toISOString();
  }
  return new Date(Date.now() + info.days * 24 * 60 * 60 * 1000).toISOString();
}

export type NewPost = {
  kind: string;
  body: string;
  topic?: string | null;
  happensOn?: string | null; // YYYY-MM-DD
  proId?: string | null;
  photo?: { bytes: ArrayBuffer; type: string } | null;
};

export async function createPost(db: SupabaseClient, userId: string, input: NewPost): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const person = await me(db, userId);
  if (!person?.household_id) return { ok: false, error: "Finish signing up first." };
  if (person.banned) return { ok: false, error: "Your account can't post right now." };
  if (!isKind(input.kind)) return { ok: false, error: "Pick what kind of post this is." };
  const kind = input.kind;
  const info = KINDS[kind];

  const body = input.body.trim().replace(/[ \t]+/g, " ");
  if (!body) return { ok: false, error: "Add a few words." };
  const check = checkNote(body, POST_MAX);
  if (!check.ok) return { ok: false, error: check.reason.replace("Notes", "Posts") };

  let topic: string | null = null;
  if (kind === "heads_up") {
    topic = HEADS_UP_TOPICS.some((t) => t.id === input.topic) ? input.topic! : null;
    if (!topic) return { ok: false, error: "Pick what the heads-up is about: roads, weather, power or water." };
  }

  let happensOn: string | null = null;
  if (info.needsDate) {
    if (!input.happensOn || !/^\d{4}-\d{2}-\d{2}$/.test(input.happensOn)) return { ok: false, error: "Pick the date." };
    const today = new Date().toISOString().slice(0, 10);
    const max = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (input.happensOn < today || input.happensOn > max) return { ok: false, error: "Pick a date in the next two months." };
    happensOn = input.happensOn;
  }

  let proId: string | null = null;
  if (kind === "just_hired" && input.proId) {
    const { data: pro } = await db.from("pros").select("id, status").eq("id", input.proId).maybeSingle();
    if (pro?.status === "active") proId = pro.id;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("porch_posts").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_POSTS_PER_DAY) return { ok: false, error: `That's ${MAX_POSTS_PER_DAY} posts today. Try again tomorrow.` };

  if (input.photo) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(input.photo.type)) return { ok: false, error: "Photos need to be JPG, PNG or WebP." };
    if (input.photo.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: "That photo is too big (5 MB max)." };
  }

  const { data: post, error } = await db
    .from("porch_posts")
    .insert({
      profile_id: userId,
      household_id: person.household_id,
      kind,
      topic,
      body,
      pro_id: proId,
      happens_on: happensOn,
      expires_at: expiryFor(kind, happensOn),
    })
    .select("id")
    .single();
  if (error || !post) return { ok: false, error: "Couldn't post that. Try again." };

  if (input.photo) {
    const ext = input.photo.type === "image/png" ? "png" : input.photo.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${post.id}.${ext}`;
    const up = await db.storage.from(PORCH_BUCKET).upload(path, input.photo.bytes, { contentType: input.photo.type, upsert: true });
    if (!up.error) await db.from("porch_posts").update({ photo_path: path }).eq("id", post.id);
  }
  return { ok: true, id: post.id };
}

export type FeedItem =
  | {
      type: "post";
      id: string;
      kind: PorchKind;
      who: string;
      initial: string;
      mine: boolean;
      when: string;
      body: string;
      topic: string | null;
      photoUrl: string | null;
      pro: { id: string; name: string; color: string | null; logoUrl: string | null } | null;
      happensOn: string | null;
      done: boolean;
      thumbs: number;
      love: number;
      myReaction: "thumbs_up" | "love" | null;
      actionCount: number;
      myAction: boolean;
      createdAt: string;
    }
  | { type: "ask"; id: string; who: string; categoryName: string; icon: string; when: string; answers: number; createdAt: string };

type PostRow = {
  id: string;
  profile_id: string;
  kind: PorchKind;
  topic: string | null;
  body: string;
  photo_path: string | null;
  happens_on: string | null;
  done: boolean;
  created_at: string;
  profiles: { first_name: string; last_initial: string; privacy: string; banned: boolean } | null;
  households: { display_location: unknown } | null;
  pros: { id: string; name: string; color: string | null; logo_url: string | null; status: string } | null;
  porch_reactions: { profile_id: string; reaction: "thumbs_up" | "love" }[];
  porch_actions: { profile_id: string; action: string }[];
};

// What's on the porch near this person, newest first. Asks for a pro show in All and Pros.
export async function porchFeed(db: SupabaseClient, userId: string, tab: PorchTab = "all"): Promise<FeedItem[]> {
  const person = await me(db, userId);
  if (!person?.household_id) return [];
  const here = await homePoint(db, person.household_id);
  if (!here) return [];
  const reach = reachMeters(person.reach_miles); // each person picks 1, 3 or 5 miles

  const kinds = tab === "all" ? null : (Object.keys(KINDS) as PorchKind[]).filter((k) => KINDS[k].tab === tab);
  let q = db
    .from("porch_posts")
    .select(
      "id, profile_id, kind, topic, body, photo_path, happens_on, done, created_at, profiles!porch_posts_profile_id_fkey(first_name, last_initial, privacy, banned), households!porch_posts_household_id_fkey(display_location), pros(id, name, color, logo_url, status), porch_reactions(profile_id, reaction), porch_actions(profile_id, action)"
    )
    .eq("status", "visible")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(300);
  if (kinds) q = q.in("kind", kinds.length ? kinds : ["none"]);
  const { data } = await q;

  const posts: FeedItem[] = ((data ?? []) as unknown as PostRow[])
    .filter((p) => {
      if (!p.profiles || p.profiles.banned) return false;
      const at = parsePoint(p.households?.display_location);
      return at && metersBetween(at, here) <= reach;
    })
    .map((p) => {
      const hidden = p.profiles!.privacy === "hidden";
      const info = KINDS[p.kind];
      return {
        type: "post" as const,
        id: p.id,
        kind: p.kind,
        who: hidden ? "A neighbor" : `${p.profiles!.first_name} ${p.profiles!.last_initial}.`,
        initial: hidden ? "🏡" : p.profiles!.first_name.charAt(0).toUpperCase(),
        mine: p.profile_id === userId,
        when: relative(p.created_at),
        body: p.body,
        topic: p.topic,
        photoUrl: p.photo_path ? db.storage.from(PORCH_BUCKET).getPublicUrl(p.photo_path).data.publicUrl : null,
        pro: p.pros && p.pros.status === "active" ? { id: p.pros.id, name: p.pros.name, color: p.pros.color, logoUrl: p.pros.logo_url } : null,
        happensOn: p.happens_on,
        done: p.done,
        thumbs: p.porch_reactions.filter((r) => r.reaction === "thumbs_up").length,
        love: p.porch_reactions.filter((r) => r.reaction === "love").length,
        myReaction: p.porch_reactions.find((r) => r.profile_id === userId)?.reaction ?? null,
        actionCount: info.action ? p.porch_actions.filter((a) => a.action === info.action!.id).length : 0,
        myAction: info.action ? p.porch_actions.some((a) => a.action === info.action!.id && a.profile_id === userId) : false,
        createdAt: p.created_at,
      };
    });

  let asks: FeedItem[] = [];
  if (tab === "all" || tab === "pros") {
    const near = await asksNear(db, userId);
    asks = near
      .filter((a) => !a.answeredByMe)
      .map((a) => ({ type: "ask" as const, id: a.id, who: a.who, categoryName: a.categoryName, icon: a.icon, when: a.when, answers: a.answers, createdAt: "" }));
  }
  // Asks lead (they need an answer); posts follow newest first
  return [...asks, ...posts];
}

// "just now", "2h ago", "yesterday", or the season label for older posts
export function relative(iso: string, now = new Date()) {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return whenLabel(iso, now);
}

async function visiblePostNear(db: SupabaseClient, userId: string, postId: string) {
  const person = await me(db, userId);
  if (!person?.household_id || person.banned) return null;
  const { data } = await db
    .from("porch_posts")
    .select("id, profile_id, kind, status, expires_at")
    .eq("id", postId)
    .maybeSingle();
  if (!data || data.status !== "visible" || data.expires_at < new Date().toISOString()) return null;
  return { post: data as unknown as { id: string; profile_id: string; kind: PorchKind }, person };
}

export async function reactToPost(db: SupabaseClient, userId: string, postId: string, reaction: "thumbs_up" | "love" | null) {
  const ok = await visiblePostNear(db, userId, postId);
  if (!ok) return { ok: false };
  if (reaction === null) await db.from("porch_reactions").delete().eq("post_id", postId).eq("profile_id", userId);
  else await db.from("porch_reactions").upsert({ post_id: postId, profile_id: userId, reaction }, { onConflict: "post_id,profile_id" });
  return { ok: true };
}

export async function toggleAction(db: SupabaseClient, userId: string, postId: string, on: boolean) {
  const ok = await visiblePostNear(db, userId, postId);
  const action = ok ? KINDS[ok.post.kind].action?.id : null;
  if (!ok || !action) return { ok: false };
  if (on) await db.from("porch_actions").upsert({ post_id: postId, profile_id: userId, action }, { onConflict: "post_id,profile_id,action" });
  else await db.from("porch_actions").delete().eq("post_id", postId).eq("profile_id", userId).eq("action", action);
  return { ok: true };
}

// The poster marks it Taken / Found / Resolved (stays visible a little, faded)
export async function markDone(db: SupabaseClient, userId: string, postId: string) {
  const { error, count } = await db.from("porch_posts").update({ done: true }, { count: "exact" }).eq("id", postId).eq("profile_id", userId);
  return { ok: !error && !!count };
}

export async function deletePost(db: SupabaseClient, userId: string, postId: string) {
  const { data } = await db.from("porch_posts").select("photo_path").eq("id", postId).eq("profile_id", userId).maybeSingle();
  if (!data) return { ok: false };
  if (data.photo_path) await db.storage.from(PORCH_BUCKET).remove([data.photo_path]);
  await db.from("porch_posts").delete().eq("id", postId).eq("profile_id", userId);
  return { ok: true };
}

// Neighbors moderate: once 3 different homes report a post, it hides itself.
export async function reportPost(db: SupabaseClient, userId: string, postId: string, reason: string) {
  const ok = await visiblePostNear(db, userId, postId);
  if (!ok) return { ok: false, hidden: false };
  if (ok.post.profile_id === userId) return { ok: false, hidden: false };
  await db
    .from("porch_reports")
    .upsert({ post_id: postId, profile_id: userId, household_id: ok.person.household_id, reason: reason.slice(0, 60) }, { onConflict: "post_id,household_id" });
  const { count } = await db.from("porch_reports").select("id", { count: "exact", head: true }).eq("post_id", postId);
  if ((count ?? 0) >= REPORTS_TO_HIDE) {
    await db.from("porch_posts").update({ status: "hidden" }).eq("id", postId);
    return { ok: true, hidden: true };
  }
  return { ok: true, hidden: false };
}

// How many new posts near you since a time (for the badge on the Porch button)
export async function newPostCount(db: SupabaseClient, userId: string, sinceIso: string) {
  const feed = await porchFeed(db, userId, "all");
  return feed.filter((f) => f.type === "post" && !f.mine && f.createdAt > sinceIso).length;
}
