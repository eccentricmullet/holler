import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNote } from "@/lib/note-filter";
import { hoodLabel, metersBetween, milesLabel, parsePoint } from "@/lib/geo";
import { PORCH_RADIUS_M } from "@/lib/reach";
import { relative, PORCH_BUCKET } from "@/lib/porch";
import type { Alert } from "@/lib/push";
import {
  CURB_DAYS,
  CURB_MAX_PHOTOS,
  CURB_NOTE_MAX,
  CURB_PRICE_MAX,
  CURB_TITLE_MAX,
  isCurbKind,
  priceLabel,
  type CurbFilter,
  type CurbKind,
} from "@/lib/curb-kinds";

// The Curb (redesign phase 4): sell or give away things to neighbors within 20 miles.
// "I'm interested" puts you on the seller's list (they get your number); the seller picks who to text.
export const MAX_CURB_ITEMS_PER_DAY = 5;
export const CURB_REPORTS_TO_HIDE = 3; // from different homes
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Me = { id: string; household_id: string | null; banned: boolean };

async function me(db: SupabaseClient, userId: string) {
  const { data } = await db.from("profiles").select("id, household_id, banned").eq("id", userId).maybeSingle();
  return data as Me | null;
}

async function homePoint(db: SupabaseClient, householdId: string) {
  const { data } = await db.from("households").select("display_location").eq("id", householdId).single();
  return parsePoint(data?.display_location);
}

const photoUrl = (db: SupabaseClient, path: string) => db.storage.from(PORCH_BUCKET).getPublicUrl(path).data.publicUrl;
// Short "time ago" for the grid cards: "now", "20m", "2h", "3d"
const shortWhen = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 2 ? "now" : mins < 60 ? `${mins}m` : mins < 60 * 24 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 60 / 24)}d`;
};
const tidy = (s: string | null | undefined, max: number) => (s ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);

export type NewCurbItem = {
  title: string;
  note?: string | null;
  price: number; // whole dollars; 0 = Free
  kind: string;
  photos: { bytes: ArrayBuffer; type: string }[];
};

export async function createCurbItem(db: SupabaseClient, userId: string, input: NewCurbItem): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const person = await me(db, userId);
  if (!person?.household_id) return { ok: false, error: "Finish signing up first." };
  if (person.banned) return { ok: false, error: "Your account can't list things right now." };

  const title = tidy(input.title, CURB_TITLE_MAX + 1);
  if (title.length < 2) return { ok: false, error: "Add a title, like “Kids bike” or “Couch”." };
  if (title.length > CURB_TITLE_MAX) return { ok: false, error: `Keep the title to ${CURB_TITLE_MAX} characters.` };
  const note = tidy(input.note, CURB_NOTE_MAX + 1);
  for (const [text, max] of [[title, CURB_TITLE_MAX], [note, CURB_NOTE_MAX]] as const) {
    const check = checkNote(text, max);
    if (!check.ok) return { ok: false, error: check.reason.replace("Notes", "Listings") };
  }
  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price < 0 || price > CURB_PRICE_MAX) return { ok: false, error: "Check the price." };
  const kind: CurbKind = isCurbKind(input.kind) ? input.kind : "other";

  const photos = input.photos ?? [];
  if (!photos.length) return { ok: false, error: "Add at least one photo." };
  if (photos.length > CURB_MAX_PHOTOS) return { ok: false, error: `Up to ${CURB_MAX_PHOTOS} photos.` };
  for (const p of photos) {
    if (!PHOTO_TYPES.includes(p.type)) return { ok: false, error: "Photos need to be JPG, PNG or WebP." };
    if (p.bytes.byteLength > 5 * 1024 * 1024) return { ok: false, error: "One of the photos is too big (5 MB max)." };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("curb_items").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_CURB_ITEMS_PER_DAY) return { ok: false, error: `That's ${MAX_CURB_ITEMS_PER_DAY} items today. Try again tomorrow.` };

  const { data: item, error } = await db
    .from("curb_items")
    .insert({
      profile_id: userId,
      household_id: person.household_id,
      title,
      note: note || null,
      price,
      kind,
      expires_at: new Date(Date.now() + CURB_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !item) return { ok: false, error: "Couldn't list that. Try again." };

  const paths: string[] = [];
  for (const [i, p] of photos.entries()) {
    const ext = p.type === "image/png" ? "png" : p.type === "image/webp" ? "webp" : "jpg";
    const path = `curb/${userId}/${item.id}-${i}.${ext}`;
    const up = await db.storage.from(PORCH_BUCKET).upload(path, p.bytes, { contentType: p.type, upsert: true });
    if (!up.error) paths.push(path);
  }
  if (!paths.length) {
    await db.from("curb_items").delete().eq("id", item.id);
    return { ok: false, error: "Couldn't upload the photos. Try again." };
  }
  await db.from("curb_items").update({ photo_paths: paths }).eq("id", item.id);
  return { ok: true, id: item.id };
}

export type CurbCard = {
  id: string;
  title: string;
  price: number;
  priceLabel: string;
  kind: CurbKind;
  photoUrl: string | null;
  hood: string | null;
  distance: string | null;
  when: string;
  mine: boolean;
  createdAt: string;
};

type ItemRow = {
  id: string;
  profile_id: string;
  title: string;
  note: string | null;
  price: number;
  kind: CurbKind;
  photo_paths: string[];
  status: string;
  gone: boolean;
  expires_at: string;
  created_at: string;
  profiles: { first_name: string; last_initial: string; privacy: string; banned: boolean } | null;
  households: { display_location: unknown; neighborhood: string | null; city: string | null } | null;
};

const ITEM_FIELDS =
  "id, profile_id, title, note, price, kind, photo_paths, status, gone, expires_at, created_at, profiles!curb_items_profile_id_fkey(first_name, last_initial, privacy, banned), households!curb_items_household_id_fkey(display_location, neighborhood, city)";

const matches = (filter: CurbFilter, i: { price: number; kind: CurbKind }) =>
  filter === "all" ? true : filter === "free" ? i.price === 0 : filter === "under25" ? i.price < 25 : i.kind === filter;

// What's on the Curb within 20 miles, newest first
export async function curbFeed(db: SupabaseClient, userId: string, filter: CurbFilter = "all", search = ""): Promise<CurbCard[]> {
  const person = await me(db, userId);
  if (!person?.household_id) return [];
  const here = await homePoint(db, person.household_id);
  if (!here) return [];
  const { data } = await db
    .from("curb_items")
    .select(ITEM_FIELDS)
    .eq("status", "visible")
    .eq("gone", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(300);
  const words = search.trim().toLowerCase();
  return ((data ?? []) as unknown as ItemRow[])
    .map((r) => ({ r, at: parsePoint(r.households?.display_location) }))
    .filter(({ r, at }) => r.profiles && !r.profiles.banned && at && metersBetween(at, here) <= PORCH_RADIUS_M)
    .filter(({ r }) => matches(filter, r))
    .filter(({ r }) => !words || `${r.title} ${r.note ?? ""}`.toLowerCase().includes(words))
    .map(({ r, at }) => {
      const mine = r.profile_id === userId;
      const hidden = r.profiles!.privacy === "hidden";
      return {
        id: r.id,
        title: r.title,
        price: r.price,
        priceLabel: priceLabel(r.price),
        kind: r.kind,
        photoUrl: r.photo_paths[0] ? photoUrl(db, r.photo_paths[0]) : null,
        hood: hidden ? null : hoodLabel(r.households),
        distance: mine || hidden ? null : milesLabel(metersBetween(at!, here)),
        when: shortWhen(r.created_at),
        mine,
        createdAt: r.created_at,
      };
    });
}

export type Interested = { id: string; who: string; phone: string | null; when: string };

export type CurbDetail = {
  id: string;
  title: string;
  note: string | null;
  price: number;
  priceLabel: string;
  kind: CurbKind;
  photoUrls: string[];
  who: string;
  initials: string;
  hood: string | null;
  distance: string | null;
  when: string;
  mine: boolean;
  gone: boolean;
  expired: boolean;
  iAmInterested: boolean;
  interestCount: number;
  interested: Interested[]; // seller only
};

// "+16155550101" from however the phone sign-in stored it
const e164 = (phone: string | null | undefined) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : digits.length >= 11 ? `+${digits}` : null;
};

// One item, for its page. Neighbors within 20 miles can see it; the seller also sees who's interested.
export async function curbItem(db: SupabaseClient, userId: string, itemId: string): Promise<CurbDetail | null> {
  const person = await me(db, userId);
  if (!person?.household_id) return null;
  const { data } = await db.from("curb_items").select(ITEM_FIELDS).eq("id", itemId).maybeSingle();
  const r = data as unknown as ItemRow | null;
  if (!r || !r.profiles) return null;
  const mine = r.profile_id === userId;
  const here = await homePoint(db, person.household_id);
  const at = parsePoint(r.households?.display_location);
  if (!mine) {
    if (r.status !== "visible" || r.profiles.banned || !here || !at || metersBetween(at, here) > PORCH_RADIUS_M) return null;
  }
  const { data: interest } = await db
    .from("curb_interest")
    .select("id, profile_id, created_at, profiles(first_name, last_initial, privacy)")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  const rows = (interest ?? []) as unknown as { id: string; profile_id: string; created_at: string; profiles: { first_name: string; last_initial: string } | null }[];

  // The seller sees each interested neighbor's name and number (they agreed to share it by tapping)
  const interested: Interested[] = mine
    ? await Promise.all(
        rows.map(async (i) => {
          const { data: u } = await db.auth.admin.getUserById(i.profile_id);
          return {
            id: i.id,
            who: i.profiles ? `${i.profiles.first_name} ${i.profiles.last_initial}.` : "A neighbor",
            phone: e164(u?.user?.phone),
            when: relative(i.created_at),
          };
        })
      )
    : [];

  const hidden = r.profiles.privacy === "hidden";
  return {
    id: r.id,
    title: r.title,
    note: r.note,
    price: r.price,
    priceLabel: priceLabel(r.price),
    kind: r.kind,
    photoUrls: r.photo_paths.map((p) => photoUrl(db, p)),
    who: hidden ? "A neighbor" : `${r.profiles.first_name} ${r.profiles.last_initial}.`,
    initials: hidden ? "🏡" : `${r.profiles.first_name.charAt(0)}${r.profiles.last_initial}`.toUpperCase(),
    hood: hidden ? null : hoodLabel(r.households),
    distance: mine || hidden || !here || !at ? null : milesLabel(metersBetween(at, here)),
    when: relative(r.created_at),
    mine,
    gone: r.gone,
    expired: r.expires_at < new Date().toISOString(),
    iAmInterested: rows.some((i) => i.profile_id === userId),
    interestCount: rows.length,
    interested,
  };
}

// Your own items, newest first, with how many neighbors are interested
export async function myCurbItems(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("curb_items")
    .select("id, title, price, photo_paths, gone, status, expires_at, created_at, curb_interest(count)")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const now = new Date().toISOString();
  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    price: number;
    photo_paths: string[];
    gone: boolean;
    status: string;
    expires_at: string;
    curb_interest: { count: number }[];
  }[]).map((r) => ({
    id: r.id,
    title: r.title,
    priceLabel: priceLabel(r.price),
    photoUrl: r.photo_paths[0] ? photoUrl(db, r.photo_paths[0]) : null,
    live: !r.gone && r.status === "visible" && r.expires_at > now,
    interested: r.curb_interest[0]?.count ?? 0,
  }));
}

async function liveItem(db: SupabaseClient, itemId: string) {
  const { data } = await db.from("curb_items").select("id, profile_id, title, status, gone, expires_at").eq("id", itemId).maybeSingle();
  if (!data || data.status !== "visible" || data.gone || data.expires_at < new Date().toISOString()) return null;
  return data as { id: string; profile_id: string; title: string };
}

// "I'm interested" on/off. Returns the seller to alert when someone new is interested.
export async function setInterest(
  db: SupabaseClient,
  userId: string,
  itemId: string,
  on: boolean
): Promise<{ ok: true; alert: { sellerId: string; title: string } | null } | { ok: false; error: string }> {
  const person = await me(db, userId);
  if (!person?.household_id || person.banned) return { ok: false, error: "Your account can't do that right now." };
  const item = await liveItem(db, itemId);
  if (!item) return { ok: false, error: "This item is gone." };
  if (item.profile_id === userId) return { ok: false, error: "That's your own item." };
  if (!on) {
    await db.from("curb_interest").delete().eq("item_id", itemId).eq("profile_id", userId);
    return { ok: true, alert: null };
  }
  const { data, error } = await db
    .from("curb_interest")
    .upsert({ item_id: itemId, profile_id: userId }, { onConflict: "item_id,profile_id", ignoreDuplicates: true })
    .select("id");
  if (error) return { ok: false, error: "Couldn't do that. Try again." };
  return { ok: true, alert: data?.length ? { sellerId: item.profile_id, title: item.title } : null };
}

// The seller marks it gone: it comes off the Curb right away (and is deleted a week later)
export async function markGone(db: SupabaseClient, userId: string, itemId: string) {
  const { error, count } = await db
    .from("curb_items")
    .update({ gone: true, expires_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", itemId)
    .eq("profile_id", userId);
  return { ok: !error && !!count };
}

// Neighbors moderate: once 3 different homes report an item, it hides itself.
export async function reportCurbItem(db: SupabaseClient, userId: string, itemId: string, reason: string) {
  const person = await me(db, userId);
  const item = await liveItem(db, itemId);
  if (!person?.household_id || person.banned || !item || item.profile_id === userId) return { ok: false, hidden: false };
  await db
    .from("curb_reports")
    .upsert({ item_id: itemId, profile_id: userId, household_id: person.household_id, reason: reason.slice(0, 60) }, { onConflict: "item_id,household_id" });
  const { count } = await db.from("curb_reports").select("id", { count: "exact", head: true }).eq("item_id", itemId);
  if ((count ?? 0) >= CURB_REPORTS_TO_HIDE) {
    await db.from("curb_items").update({ status: "hidden" }).eq("id", itemId);
    return { ok: true, hidden: true };
  }
  return { ok: true, hidden: false };
}

export function interestAlert(title: string, itemId: string): Alert {
  return { title: "Someone's interested 🙌", body: `A neighbor wants your ${title}. Tap to see who and text them.`, url: `/curb/${itemId}`, tag: `curb-${itemId}` };
}

// Items gone or expired over a week ago are deleted for good, photos included.
export async function purgeOldCurbItems(db: SupabaseClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: old } = await db.from("curb_items").select("id, photo_paths").lt("expires_at", cutoff).limit(500);
  if (!old?.length) return 0;
  const photos = old.flatMap((p) => p.photo_paths as string[]);
  if (photos.length) await db.storage.from(PORCH_BUCKET).remove(photos);
  await db.from("curb_items").delete().in("id", old.map((p) => p.id));
  return old.length;
}
