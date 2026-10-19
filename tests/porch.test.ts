// The Porch (11k): a self-running neighborhood board. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { createPost, markDone, MAX_POSTS_PER_DAY, porchFeed, reactToPost, reportPost, toggleAction, deletePost, relative, purgeExpiredPosts } from "@/lib/porch";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const db: SupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const MARK = "TEST SEED";
const RUN = Math.random().toString(36).slice(2, 8);
const ids: string[] = [];

// Spread out on purpose: 0.01° latitude ≈ 1.1 km
async function person(n: number, lat: number, name: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `porch-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat, lng: -86.2, neighborhood: null }, {
    firstName: name,
    lastInitial: "T",
    privacy: "block",
  });
  return data.user.id;
}

let poster = "", near1 = "", near2 = "", near3 = "", far = "";
beforeAll(async () => {
  poster = await person(1, 35.4, "Pat");
  near1 = await person(2, 35.41, "Nia"); // ~1.1 km
  near2 = await person(3, 35.415, "Ned"); // ~1.7 km
  near3 = await person(4, 35.39, "Noa"); // ~1.1 km
  far = await person(5, 35.5, "Fay"); // ~11 km
});

afterAll(async () => {
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of ids) await db.auth.admin.deleteUser(id);
});

const today = () => new Date().toISOString().slice(0, 10);

describe("The Porch", () => {
  let curbId = "", petId = "";

  it("posts a curb alert that neighbors within 2 miles see, and far-away ones don't", async () => {
    const r = await createPost(db, poster, { kind: "curb_alert", body: "Free couch on the curb, good shape!" });
    expect(r.ok).toBe(true);
    if (r.ok) curbId = r.id;
    const seen = (await porchFeed(db, near1, "sales")).find((f) => f.id === curbId);
    expect(seen).toMatchObject({ type: "post", who: "Pat T.", kind: "curb_alert", mine: false });
    expect((await porchFeed(db, far, "all")).find((f) => f.id === curbId)).toBeUndefined();
    expect((await porchFeed(db, near1, "pets")).find((f) => f.id === curbId)).toBeUndefined(); // wrong tab
  });

  it("curb alerts expire after 2 days; garage sales the day after the sale", async () => {
    const { data: curb } = await db.from("porch_posts").select("expires_at, created_at").eq("id", curbId).single();
    const hours = (new Date(curb!.expires_at).getTime() - new Date(curb!.created_at).getTime()) / 36e5;
    expect(Math.round(hours)).toBe(48);
    const sale = await createPost(db, poster, { kind: "garage_sale", body: "Big sale, toys and tools", happensOn: today() });
    expect(sale.ok).toBe(true);
    const missingDate = await createPost(db, poster, { kind: "garage_sale", body: "Sale!" });
    expect(missingDate).toMatchObject({ ok: false, error: expect.stringMatching(/date/i) });
  });

  it("blocks phone numbers, links and profanity, and off-topic heads-ups", async () => {
    expect(await createPost(db, poster, { kind: "new_neighbor", body: "Call me 615-555-0123" })).toMatchObject({ ok: false });
    expect(await createPost(db, poster, { kind: "new_neighbor", body: "see mysite.com" })).toMatchObject({ ok: false });
    expect(await createPost(db, poster, { kind: "new_neighbor", body: "this street is shit" })).toMatchObject({ ok: false });
    expect(await createPost(db, poster, { kind: "heads_up", body: "Someone weird walking around" })).toMatchObject({ ok: false });
  });

  it("reactions and one-tap actions count per neighbor", async () => {
    const r = await createPost(db, poster, { kind: "lost_pet", body: "Gray cat named Milo, last seen by the pond" });
    expect(r.ok).toBe(true);
    if (r.ok) petId = r.id;
    await reactToPost(db, near1, petId, "love");
    await reactToPost(db, near2, petId, "thumbs_up");
    await reactToPost(db, near2, petId, "love"); // switching
    await toggleAction(db, near1, petId, true);
    const item = (await porchFeed(db, near1, "pets")).find((f) => f.id === petId);
    expect(item).toMatchObject({ love: 2, thumbs: 0, myReaction: "love", actionCount: 1, myAction: true });
  });

  it("only the poster can mark it done or delete it", async () => {
    expect((await markDone(db, near1, petId)).ok).toBe(false);
    expect((await markDone(db, poster, petId)).ok).toBe(true);
    expect((await porchFeed(db, near1, "pets")).find((f) => f.id === petId)).toMatchObject({ done: true });
    expect((await deletePost(db, near1, petId)).ok).toBe(false);
  });

  it("hides itself after 3 different homes report it", async () => {
    const r = await reportPost(db, near1, curbId, "Spam");
    const again = await reportPost(db, near1, curbId, "Spam"); // same home doesn't count twice
    const second = await reportPost(db, near2, curbId, "Spam");
    expect(r.hidden || again.hidden || second.hidden).toBe(false);
    const third = await reportPost(db, near3, curbId, "Spam");
    expect(third.hidden).toBe(true);
    expect((await porchFeed(db, near1, "all")).find((f) => f.id === curbId)).toBeUndefined();
  });

  it(`limits posts to ${MAX_POSTS_PER_DAY} a day`, async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await createPost(db, poster, { kind: "new_neighbor", body: `Hi neighbors ${i}` }));
    expect(results.at(-1)).toMatchObject({ ok: false, error: expect.stringMatching(/tomorrow/i) });
  });

  it("shows friendly times", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    expect(relative("2026-10-19T11:59:30Z", now)).toBe("just now");
    expect(relative("2026-10-19T09:00:00Z", now)).toBe("3h ago");
    expect(relative("2026-10-18T10:00:00Z", now)).toBe("yesterday");
  });
});

describe("Porch cleanup", () => {
  it("deletes posts a week after they expire, and leaves fresh ones alone", async () => {
    // Inserted directly: the daily post limit is already used up by the tests above
    const { data: me } = await db.from("profiles").select("household_id").eq("id", poster).single();
    const { data: old } = await db
      .from("porch_posts")
      .insert({ profile_id: poster, household_id: me!.household_id, kind: "curb_alert", body: "Long gone", expires_at: new Date(Date.now() - 9 * 864e5).toISOString() })
      .select("id")
      .single();
    expect(await purgeExpiredPosts(db)).toBeGreaterThanOrEqual(1);
    const { count: gone } = await db.from("porch_posts").select("id", { count: "exact", head: true }).eq("id", old!.id);
    expect(gone).toBe(0);
    const { count: fresh } = await db.from("porch_posts").select("id", { count: "exact", head: true }).eq("profile_id", poster);
    expect(fresh).toBeGreaterThan(0);
  });
});
