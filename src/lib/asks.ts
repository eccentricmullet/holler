import type { SupabaseClient } from "@supabase/supabase-js";
import { checkNote } from "@/lib/note-filter";
import { hoodLabel, metersBetween, milesLabel, parsePoint } from "@/lib/geo";
import { PORCH_RADIUS_M } from "@/lib/reach";
import { whenLabel } from "@/lib/recency";
import { saveReaction, type Actor, type ProChoice } from "@/lib/reactions";
import { isTiming, type Timing } from "@/lib/ask-timing";

// Pro requests on the Porch (redesign phase 3, built on 11h "Ask the neighborhood").
// Neighbors answer with a pro (never free text), and each answer is also a reaction, so asking makes the map better.
export const ASK_DAYS_OPEN = 7;
export const MAX_ASKS_PER_DAY = 3;
export const ASK_NOTE_MAX = 120;

export { TIMINGS, type Timing } from "@/lib/ask-timing";

type ProfileRow = { id: string; household_id: string | null; banned: boolean; first_name: string; last_initial: string; privacy: string };

async function profileOf(db: SupabaseClient, userId: string) {
  const { data } = await db
    .from("profiles")
    .select("id, household_id, banned, first_name, last_initial, privacy")
    .eq("id", userId)
    .maybeSingle();
  return data as ProfileRow | null;
}

const since = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export type NewAskInput = { category: string; timing?: string; neededOn?: string | null; note?: string | null };

export async function createAsk(
  db: SupabaseClient,
  userId: string,
  input: string | NewAskInput
): Promise<{ ok: true; askId: string } | { ok: false; error: string }> {
  const ask = typeof input === "string" ? { category: input } : input;
  const me = await profileOf(db, userId);
  if (!me?.household_id) return { ok: false, error: "Finish signing up first." };
  if (me.banned) return { ok: false, error: "Your account can't ask right now." };
  const { data: cat } = await db.from("categories").select("id").eq("slug", ask.category).maybeSingle();
  if (!cat) return { ok: false, error: "Pick who you need." };

  const timing: Timing = isTiming(ask.timing) ? ask.timing : "planning";
  let neededOn: string | null = null;
  if (timing === "date") {
    if (!ask.neededOn || !/^\d{4}-\d{2}-\d{2}$/.test(ask.neededOn)) return { ok: false, error: "Pick the date you need them." };
    const today = new Date().toISOString().slice(0, 10);
    const max = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (ask.neededOn < today || ask.neededOn > max) return { ok: false, error: "Pick a date in the next three months." };
    neededOn = ask.neededOn;
  }
  const note = (ask.note ?? "").trim().replace(/\s+/g, " ");
  if (note) {
    const check = checkNote(note, ASK_NOTE_MAX);
    if (!check.ok) return { ok: false, error: check.reason };
  }
  const details = { timing, needed_on: neededOn, note: note || null };

  // Already asking about this? Update it instead of posting twice.
  const { data: open } = await db
    .from("asks")
    .select("id")
    .eq("profile_id", userId)
    .eq("category_id", cat.id)
    .eq("status", "open")
    .gte("created_at", since(ASK_DAYS_OPEN))
    .maybeSingle();
  if (open) {
    if (typeof input !== "string") await db.from("asks").update(details).eq("id", open.id);
    return { ok: true, askId: open.id };
  }

  const { count } = await db.from("asks").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since(1));
  if ((count ?? 0) >= MAX_ASKS_PER_DAY) return { ok: false, error: `That's ${MAX_ASKS_PER_DAY} requests today. Try again tomorrow.` };

  const { data, error } = await db
    .from("asks")
    .insert({ profile_id: userId, household_id: me.household_id, category_id: cat.id, ...details })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't send that. Try again." };
  return { ok: true, askId: data.id };
}

type SuggestedPro = { proId: string; name: string; logoUrl: string | null; color: string | null; count: number };

export type NearbyAsk = {
  id: string;
  who: string; // "Sarah K." or "A neighbor"
  initials: string;
  hood: string | null; // neighborhood (or city)
  distance: string | null; // "3 mi"
  categorySlug: string;
  categoryName: string;
  icon: string;
  timing: Timing;
  neededOn: string | null;
  note: string | null;
  when: string;
  createdAt: string;
  answers: number;
  answeredByMe: boolean;
  mine: boolean;
  open: boolean;
  chosen: { proId: string; name: string } | null; // "Found someone"
  suggestions: SuggestedPro[]; // most-recommended first
};

type ProLite = { id: string; name: string; logo_url: string | null; color: string | null; status: string };
type AskRow = {
  id: string;
  profile_id: string;
  household_id: string;
  status: string;
  timing: Timing | null;
  needed_on: string | null;
  note: string | null;
  created_at: string;
  closed_at: string | null;
  categories: { slug: string; name: string; icon: string } | null;
  profiles: { first_name: string; last_initial: string; privacy: string; banned: boolean } | null;
  households: { display_location: unknown; neighborhood: string | null; city: string | null } | null;
  chosen: ProLite | null;
  ask_answers: { profile_id: string; pro_id: string; pros: ProLite | null }[];
};

const ASK_FIELDS =
  "id, profile_id, household_id, status, timing, needed_on, note, created_at, closed_at, categories(slug, name, icon), profiles!asks_profile_id_fkey(first_name, last_initial, privacy, banned), households!asks_household_id_fkey(display_location, neighborhood, city), chosen:pros!asks_chosen_pro_id_fkey(id, name, logo_url, color, status), ask_answers(profile_id, pro_id, pros(id, name, logo_url, color, status))";

function shape(a: AskRow, userId: string, myHouse: string, here: { lat: number; lng: number } | null): NearbyAsk {
  const hidden = a.profiles!.privacy === "hidden";
  const at = parsePoint(a.households?.display_location);
  const tally = new Map<string, SuggestedPro>();
  for (const ans of a.ask_answers) {
    if (!ans.pros || ans.pros.status !== "active") continue;
    const t = tally.get(ans.pros.id) ?? { proId: ans.pros.id, name: ans.pros.name, logoUrl: ans.pros.logo_url, color: ans.pros.color, count: 0 };
    t.count++;
    tally.set(t.proId, t);
  }
  return {
    id: a.id,
    who: hidden ? "A neighbor" : `${a.profiles!.first_name} ${a.profiles!.last_initial}.`,
    initials: hidden ? "🏡" : `${a.profiles!.first_name.charAt(0)}${a.profiles!.last_initial}`.toUpperCase(),
    hood: hidden ? null : hoodLabel(a.households),
    distance: !hidden && at && here && a.household_id !== myHouse ? milesLabel(metersBetween(at, here)) : null,
    categorySlug: a.categories!.slug,
    categoryName: a.categories!.name,
    icon: a.categories!.icon,
    timing: a.timing ?? "planning",
    neededOn: a.needed_on,
    note: a.note,
    when: whenLabel(a.created_at),
    createdAt: a.created_at,
    answers: a.ask_answers.length,
    answeredByMe: a.ask_answers.some((x) => x.profile_id === userId),
    mine: a.household_id === myHouse,
    open: a.status === "open",
    chosen: a.chosen && a.chosen.status === "active" ? { proId: a.chosen.id, name: a.chosen.name } : null,
    suggestions: [...tally.values()].sort((x, y) => y.count - x.count),
  };
}

// Requests within 20 miles from the last week: open ones, plus ones closed with "Found someone".
// Includes your own home's requests (marked mine).
export async function asksNear(db: SupabaseClient, userId: string): Promise<NearbyAsk[]> {
  const me = await profileOf(db, userId);
  if (!me?.household_id) return [];
  const { data: myHome } = await db.from("households").select("display_location").eq("id", me.household_id).single();
  const here = parsePoint(myHome?.display_location);
  if (!here) return [];

  const { data } = await db
    .from("asks")
    .select(ASK_FIELDS)
    .gte("created_at", since(ASK_DAYS_OPEN))
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as unknown as AskRow[])
    .filter((a) => {
      if (!a.categories || !a.profiles || a.profiles.banned) return false;
      if (a.status !== "open" && !a.chosen) return false;
      if (a.household_id === me.household_id) return true;
      const p = parsePoint(a.households?.display_location);
      return !!p && metersBetween(p, here) <= PORCH_RADIUS_M;
    })
    .map((a) => shape(a, userId, me.household_id!, here));
}

export type MyAsk = NearbyAsk;

// This person's own requests from the last two months, newest first.
export async function myAsks(db: SupabaseClient, userId: string): Promise<MyAsk[]> {
  const me = await profileOf(db, userId);
  const { data } = await db
    .from("asks")
    .select(ASK_FIELDS)
    .eq("profile_id", userId)
    .gte("created_at", since(60))
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as AskRow[])
    .filter((a) => a.categories && a.profiles)
    .map((a) => {
      const shaped = shape(a, userId, me?.household_id ?? a.household_id, null);
      // Older than a week = no longer open, even if never closed
      return { ...shaped, open: shaped.open && a.created_at >= since(ASK_DAYS_OPEN) };
    });
}

export type AskForAnswer = { id: string; who: string; categorySlug: string; categoryName: string };

// Can this person answer this ask? (open, recent, not their own household)
export async function askForAnswer(db: SupabaseClient, userId: string, askId: string): Promise<AskForAnswer | null> {
  const me = await profileOf(db, userId);
  if (!me?.household_id) return null;
  const { data } = await db
    .from("asks")
    .select("id, household_id, status, created_at, categories(slug, name), profiles!asks_profile_id_fkey(first_name, last_initial, privacy)")
    .eq("id", askId)
    .maybeSingle();
  const a = data as unknown as {
    id: string;
    household_id: string;
    status: string;
    created_at: string;
    categories: { slug: string; name: string } | null;
    profiles: { first_name: string; last_initial: string; privacy: string } | null;
  } | null;
  if (!a || !a.categories || a.status !== "open" || a.household_id === me.household_id) return null;
  if (a.created_at < since(ASK_DAYS_OPEN)) return null;
  const who = !a.profiles || a.profiles.privacy === "hidden" ? "A neighbor" : `${a.profiles.first_name} ${a.profiles.last_initial}.`;
  return { id: a.id, who, categorySlug: a.categories.slug, categoryName: a.categories.name };
}

// Answering = reacting to a pro in the ask's category (same trust rules) + recording the answer.
export async function answerAsk(
  db: SupabaseClient,
  actor: Actor,
  askId: string,
  input: { pro: ProChoice; reaction: "thumbs_up" | "love"; note: string; tags?: string[]; price?: number | null }
) {
  const ask = await askForAnswer(db, actor.userId, askId);
  if (!ask) return { ok: false as const, error: "That request is closed or isn't one you can answer." };
  const r = await saveReaction(db, actor, { ...input, category: ask.categorySlug });
  if (!r.ok) return r;
  await db.from("ask_answers").upsert({ ask_id: askId, profile_id: actor.userId, pro_id: r.proId }, { onConflict: "ask_id,profile_id" });
  return { ...r, answeredFor: ask.who };
}

// One of your own open requests (for "Found someone")
export async function myOpenAsk(db: SupabaseClient, userId: string, askId: string) {
  const { data } = await db
    .from("asks")
    .select("id, status, created_at, categories(slug, name, icon)")
    .eq("id", askId)
    .eq("profile_id", userId)
    .maybeSingle();
  const a = data as unknown as { id: string; status: string; created_at: string; categories: { slug: string; name: string; icon: string } | null } | null;
  if (!a || !a.categories || a.status !== "open") return null;
  return { id: a.id, categorySlug: a.categories.slug, categoryName: a.categories.name, icon: a.categories.icon };
}

// "Found someone": closes the request with the pro they went with. Reacting to that pro happens
// through the normal react flow first, so it counts as their vouch with the same trust rules.
export async function closeAskWithPro(db: SupabaseClient, userId: string, askId: string, proId: string | null) {
  const ask = await myOpenAsk(db, userId, askId);
  if (!ask) return { ok: false as const };
  await db
    .from("asks")
    .update({ status: "closed", chosen_pro_id: proId, closed_at: new Date().toISOString() })
    .eq("id", askId)
    .eq("profile_id", userId);
  return { ok: true as const };
}

export async function closeAsk(db: SupabaseClient, userId: string, askId: string) {
  return db.from("asks").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", askId).eq("profile_id", userId);
}
