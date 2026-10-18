import type { SupabaseClient } from "@supabase/supabase-js";
import { metersBetween, ONE_MILE_M, parsePoint } from "@/lib/geo";
import { whenLabel } from "@/lib/recency";
import { saveReaction, type Actor, type ProChoice } from "@/lib/reactions";

// 11h Ask the neighborhood. Neighbors answer with a pro (never free text), and each answer
// is also a reaction, so asking makes the map better.
export const ASK_DAYS_OPEN = 14;
export const MAX_ASKS_PER_DAY = 3;

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

export async function createAsk(db: SupabaseClient, userId: string, categorySlug: string): Promise<{ ok: true; askId: string } | { ok: false; error: string }> {
  const me = await profileOf(db, userId);
  if (!me?.household_id) return { ok: false, error: "Finish signing up first." };
  if (me.banned) return { ok: false, error: "Your account can't ask right now." };
  const { data: cat } = await db.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
  if (!cat) return { ok: false, error: "Pick a category." };

  // Already asking about this? Reuse it.
  const { data: open } = await db
    .from("asks")
    .select("id")
    .eq("profile_id", userId)
    .eq("category_id", cat.id)
    .eq("status", "open")
    .gte("created_at", since(ASK_DAYS_OPEN))
    .maybeSingle();
  if (open) return { ok: true, askId: open.id };

  const { count } = await db.from("asks").select("id", { count: "exact", head: true }).eq("profile_id", userId).gte("created_at", since(1));
  if ((count ?? 0) >= MAX_ASKS_PER_DAY) return { ok: false, error: `That's ${MAX_ASKS_PER_DAY} asks today. Try again tomorrow.` };

  const { data, error } = await db
    .from("asks")
    .insert({ profile_id: userId, household_id: me.household_id, category_id: cat.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't send that. Try again." };
  return { ok: true, askId: data.id };
}

export type NearbyAsk = {
  id: string;
  who: string; // "Sarah K." or "A neighbor"
  categorySlug: string;
  categoryName: string;
  icon: string;
  when: string;
  answers: number;
  answeredByMe: boolean;
};

type AskRow = {
  id: string;
  profile_id: string;
  household_id: string;
  created_at: string;
  categories: { slug: string; name: string; icon: string } | null;
  profiles: { first_name: string; last_initial: string; privacy: string; banned: boolean } | null;
  households: { display_location: unknown } | null;
  ask_answers: { profile_id: string }[];
};

// Open asks from other homes within a mile of this person's block.
export async function asksNear(db: SupabaseClient, userId: string): Promise<NearbyAsk[]> {
  const me = await profileOf(db, userId);
  if (!me?.household_id) return [];
  const { data: myHome } = await db.from("households").select("display_location").eq("id", me.household_id).single();
  const here = parsePoint(myHome?.display_location);
  if (!here) return [];

  const { data } = await db
    .from("asks")
    .select("id, profile_id, household_id, created_at, categories(slug, name, icon), profiles(first_name, last_initial, privacy, banned), households(display_location), ask_answers(profile_id)")
    .eq("status", "open")
    .neq("household_id", me.household_id)
    .gte("created_at", since(ASK_DAYS_OPEN))
    .order("created_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as unknown as AskRow[])
    .filter((a) => {
      const p = parsePoint(a.households?.display_location);
      return a.categories && a.profiles && !a.profiles.banned && p && metersBetween(p, here) <= ONE_MILE_M;
    })
    .map((a) => ({
      id: a.id,
      who: a.profiles!.privacy === "hidden" ? "A neighbor" : `${a.profiles!.first_name} ${a.profiles!.last_initial}.`,
      categorySlug: a.categories!.slug,
      categoryName: a.categories!.name,
      icon: a.categories!.icon,
      when: whenLabel(a.created_at),
      answers: a.ask_answers.length,
      answeredByMe: a.ask_answers.some((x) => x.profile_id === userId),
    }));
}

export type MyAsk = {
  id: string;
  categorySlug: string;
  categoryName: string;
  icon: string;
  when: string;
  open: boolean;
  suggestions: { proId: string; name: string; logoUrl: string | null; count: number }[]; // most-suggested first
};

export async function myAsks(db: SupabaseClient, userId: string): Promise<MyAsk[]> {
  const { data } = await db
    .from("asks")
    .select("id, status, created_at, categories(slug, name, icon), ask_answers(pro_id, pros(id, name, logo_url, status))")
    .eq("profile_id", userId)
    .gte("created_at", since(60))
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    status: string;
    created_at: string;
    categories: { slug: string; name: string; icon: string } | null;
    ask_answers: { pro_id: string; pros: { id: string; name: string; logo_url: string | null; status: string } | null }[];
  };
  return ((data ?? []) as unknown as Row[])
    .filter((a) => a.categories)
    .map((a) => {
      const tally = new Map<string, { proId: string; name: string; logoUrl: string | null; count: number }>();
      for (const ans of a.ask_answers) {
        if (!ans.pros || ans.pros.status !== "active") continue;
        const t = tally.get(ans.pros.id) ?? { proId: ans.pros.id, name: ans.pros.name, logoUrl: ans.pros.logo_url, count: 0 };
        t.count++;
        tally.set(t.proId, t);
      }
      return {
        id: a.id,
        categorySlug: a.categories!.slug,
        categoryName: a.categories!.name,
        icon: a.categories!.icon,
        when: whenLabel(a.created_at),
        open: a.status === "open",
        suggestions: [...tally.values()].sort((x, y) => y.count - x.count),
      };
    });
}

export type AskForAnswer = { id: string; who: string; categorySlug: string; categoryName: string };

// Can this person answer this ask? (open, recent, not their own household)
export async function askForAnswer(db: SupabaseClient, userId: string, askId: string): Promise<AskForAnswer | null> {
  const me = await profileOf(db, userId);
  if (!me?.household_id) return null;
  const { data } = await db
    .from("asks")
    .select("id, household_id, status, created_at, categories(slug, name), profiles(first_name, last_initial, privacy)")
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
  if (!ask) return { ok: false as const, error: "That ask is closed or isn't one you can answer." };
  const r = await saveReaction(db, actor, { ...input, category: ask.categorySlug });
  if (!r.ok) return r;
  await db.from("ask_answers").upsert({ ask_id: askId, profile_id: actor.userId, pro_id: r.proId }, { onConflict: "ask_id,profile_id" });
  return { ...r, answeredFor: ask.who };
}

export async function closeAsk(db: SupabaseClient, userId: string, askId: string) {
  return db.from("asks").update({ status: "closed" }).eq("id", askId).eq("profile_id", userId);
}
