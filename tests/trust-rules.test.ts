// Runs every trust rule against the real database with throwaway TEST accounts.
// Everything it makes is marked "TEST SEED" / @holler.test and removed at the end.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveReaction, MAX_REACTIONS_PER_DAY, type Actor } from "@/lib/reactions";
import { joinHousehold, MAX_ACCOUNTS_PER_HOME } from "@/lib/households";

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
const PRO_PHONE = "+16155550199";
const userIds: string[] = [];

async function makeUser(n: number) {
  const { data, error } = await db.auth.admin.createUser({ email: `trust-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  return data.user.id;
}

function home(placeId: string) {
  return { placeId, address: MARK, lat: 35.75 + Math.random() / 100, lng: -86.93, neighborhood: null };
}

async function makePros(count: number, phoneStart = 300) {
  const { data, error } = await db
    .from("pros")
    .insert(
      Array.from({ length: count }, (_, i) => ({
        name: `Trust Test Pro ${RUN} ${i}`,
        phone: `+1615555${String(phoneStart + i).padStart(4, "0")}`,
        service_area_text: MARK,
      }))
    )
    .select("id");
  if (error) throw error;
  return data.map((p) => p.id);
}

let alice: Actor; // main test user
let selfPro: string; // a pro whose phone is alice's phone

beforeAll(async () => {
  const id = await makeUser(0);
  const joined = await joinHousehold(db, id, home(`TEST-${RUN}-alice`), {
    firstName: "Alice",
    lastInitial: "T",
    privacy: "block",
  });
  expect(joined.ok).toBe(true);
  alice = { userId: id, phone: PRO_PHONE.slice(1) }; // Supabase stores phones without the "+"
  const { data } = await db
    .from("pros")
    .insert({ name: `Alice's Own Business ${RUN}`, phone: PRO_PHONE, service_area_text: MARK })
    .select("id")
    .single();
  selfPro = data!.id;
});

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
});

describe("one reaction per household per pro per category", () => {
  it("the database itself refuses a second reaction from the same home", async () => {
    const [pro] = await makePros(1, 100);
    const { data: profile } = await db.from("profiles").select("household_id").eq("id", alice.userId).single();
    const { data: cat } = await db.from("categories").select("id").eq("slug", "lawn").single();
    const row = { household_id: profile!.household_id, profile_id: alice.userId, pro_id: pro, category_id: cat!.id, reaction: "thumbs_up" };
    expect((await db.from("vouches").insert(row)).error).toBeNull();
    const dup = await db.from("vouches").insert({ ...row, reaction: "love" });
    expect(dup.error?.code).toBe("23505");
  });

  it("reacting again through the app switches the reaction instead of adding one", async () => {
    const [pro] = await makePros(1, 110);
    const first = await saveReaction(db, alice, { pro: { kind: "holler", proId: pro }, category: "pool", reaction: "thumbs_up", note: "" });
    const second = await saveReaction(db, alice, { pro: { kind: "holler", proId: pro }, category: "pool", reaction: "love", note: "" });
    expect(first.ok && second.ok).toBe(true);
    const { data } = await db.from("vouches").select("reaction").eq("pro_id", pro);
    expect(data).toEqual([{ reaction: "love" }]);
  });
});

describe("no self-reacting", () => {
  it("blocks reacting to a pro with your own phone number", async () => {
    const r = await saveReaction(db, alice, { pro: { kind: "holler", proId: selfPro }, category: "lawn", reaction: "love", note: "" });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/your own business/i) });
  });

  it("blocks adding yourself by hand", async () => {
    const r = await saveReaction(db, alice, {
      pro: { kind: "manual", name: "My Mowing", phone: "(615) 555-0199" },
      category: "lawn",
      reaction: "love",
      note: "",
    });
    expect(r.ok).toBe(false);
  });

  it("still lets you react to someone else", async () => {
    const [pro] = await makePros(1, 120);
    const r = await saveReaction(db, alice, { pro: { kind: "holler", proId: pro }, category: "lawn", reaction: "thumbs_up", note: "" });
    expect(r.ok).toBe(true);
  });
});

describe(`at most ${MAX_REACTIONS_PER_DAY} new reactions per account per day`, () => {
  it("blocks the next new reaction once the limit is reached, but still allows switching", async () => {
    const id = await makeUser(1);
    await joinHousehold(db, id, home(`TEST-${RUN}-bob`), { firstName: "Bob", lastInitial: "T", privacy: "block" });
    const bob: Actor = { userId: id, phone: "16155550888" };
    const pros = await makePros(MAX_REACTIONS_PER_DAY + 1, 400);
    for (const pro of pros.slice(0, MAX_REACTIONS_PER_DAY)) {
      const r = await saveReaction(db, bob, { pro: { kind: "holler", proId: pro }, category: "hvac", reaction: "thumbs_up", note: "" });
      expect(r.ok).toBe(true);
    }
    const over = await saveReaction(db, bob, {
      pro: { kind: "holler", proId: pros[MAX_REACTIONS_PER_DAY] },
      category: "hvac",
      reaction: "thumbs_up",
      note: "",
    });
    expect(over).toMatchObject({ ok: false, error: expect.stringMatching(/tomorrow/i) });
    const change = await saveReaction(db, bob, { pro: { kind: "holler", proId: pros[0] }, category: "hvac", reaction: "love", note: "" });
    expect(change.ok).toBe(true);
  });
});

describe(`at most ${MAX_ACCOUNTS_PER_HOME} accounts per address`, () => {
  it("lets three people share a home and blocks a fourth", async () => {
    const place = home(`TEST-${RUN}-shared`);
    for (let i = 0; i < MAX_ACCOUNTS_PER_HOME; i++) {
      const r = await joinHousehold(db, await makeUser(10 + i), place, { firstName: `P${i}`, lastInitial: "T", privacy: "hidden" });
      expect(r.ok).toBe(true);
    }
    const fourth = await joinHousehold(db, await makeUser(20), place, { firstName: "P4", lastInitial: "T", privacy: "hidden" });
    expect(fourth).toMatchObject({ ok: false, error: expect.stringMatching(/most accounts/i) });
  });
});

describe("notes are checked", () => {
  it("rejects a note with a phone number before saving anything", async () => {
    const [pro] = await makePros(1, 130);
    const r = await saveReaction(db, alice, {
      pro: { kind: "holler", proId: pro },
      category: "lawn",
      reaction: "love",
      note: "call 615-555-0123",
    });
    expect(r.ok).toBe(false);
    const { count } = await db.from("vouches").select("id", { count: "exact", head: true }).eq("pro_id", pro);
    expect(count).toBe(0);
  });
});

describe("phone-verified account required", () => {
  it("blocks a user who hasn't finished signing up", async () => {
    const id = await makeUser(30);
    const [pro] = await makePros(1, 140);
    const r = await saveReaction(db, { userId: id, phone: null }, { pro: { kind: "holler", proId: pro }, category: "lawn", reaction: "love", note: "" });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/signing up/i) });
  });
});
