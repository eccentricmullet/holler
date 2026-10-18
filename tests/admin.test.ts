// Admin tools: merging duplicates, the flag queue, banning. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mergePros, openFlags, setBanned } from "@/lib/admin";
import { joinHousehold } from "@/lib/households";
import { saveReaction, type Actor } from "@/lib/reactions";

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
const userIds: string[] = [];

async function person(n: number): Promise<Actor> {
  const { data, error } = await db.auth.admin.createUser({ email: `admin-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat: 35.75, lng: -86.93, neighborhood: null }, {
    firstName: `A${n}`,
    lastInitial: "T",
    privacy: "block",
  });
  return { userId: data.user.id, phone: null };
}

async function pro(name: string, phone: string | null) {
  const { data, error } = await db.from("pros").insert({ name: `${name} ${RUN}`, phone, service_area_text: MARK }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

const react = (a: Actor, proId: string, reaction: "thumbs_up" | "love" = "thumbs_up") =>
  saveReaction(db, a, { pro: { kind: "holler", proId }, category: "lawn", reaction, note: "" });

let one: Actor, two: Actor, three: Actor;
beforeAll(async () => {
  [one, two, three] = [await person(1), await person(2), await person(3)];
});

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
});

describe("merge duplicate pros", () => {
  it("moves reactions and flags, keeps one reaction per home, hides the duplicate, fills missing details", async () => {
    const keep = await pro("Greenway Lawn", null);
    const dupe = await pro("Green Way Lawn Care", "+16155550555");
    await react(one, keep, "love"); // home 1 reacted to both
    await react(one, dupe, "thumbs_up");
    await react(two, dupe); // home 2 only to the duplicate
    await db.from("flags").insert({ pro_id: dupe, profile_id: three.userId, reason: "test" });

    const r = await mergePros(db, dupe, keep);
    expect(r).toEqual({ ok: true, moved: 1 });

    const { data: kept } = await db.from("vouches").select("profile_id, reaction").eq("pro_id", keep).order("profile_id");
    expect(kept).toHaveLength(2);
    expect(kept!.find((v) => v.profile_id === one.userId)?.reaction).toBe("love"); // kept pro's reaction wins
    const { count: left } = await db.from("vouches").select("id", { count: "exact", head: true }).eq("pro_id", dupe);
    expect(left).toBe(0);
    const { count: flagsMoved } = await db.from("flags").select("id", { count: "exact", head: true }).eq("pro_id", keep);
    expect(flagsMoved).toBe(1);

    const { data: d } = await db.from("pros").select("status, merged_into_id").eq("id", dupe).single();
    expect(d).toEqual({ status: "hidden", merged_into_id: keep });
    const { data: k } = await db.from("pros").select("phone").eq("id", keep).single();
    expect(k!.phone).toBe("+16155550555");
  });

  it("refuses to merge a pro into itself", async () => {
    const p = await pro("Solo Pro", null);
    expect(await mergePros(db, p, p)).toMatchObject({ ok: false });
  });

  it("reacting to a merged pro lands on the kept one", async () => {
    const keep = await pro("Keep Me", null);
    const dupe = await pro("Dupe Me", null);
    await mergePros(db, dupe, keep);
    const r = await react(three, dupe);
    expect(r).toMatchObject({ ok: true, proId: keep });
  });
});

describe("flag queue", () => {
  it("shows open flags with the pro, reporter and reported note; cleared flags drop off", async () => {
    const p = await pro("Flagged Pro", null);
    await saveReaction(db, two, { pro: { kind: "holler", proId: p }, category: "pool", reaction: "thumbs_up", note: "pretty good" });
    const { data: v } = await db.from("vouches").select("id").eq("pro_id", p).single();
    const { data: proFlag } = await db.from("flags").insert({ pro_id: p, profile_id: one.userId, reason: "Poor work" }).select("id").single();
    await db.from("flags").insert({ vouch_id: v!.id, profile_id: three.userId, reason: "Not true" });

    const queue = (await openFlags(db)).filter((f) => f.pro?.id === p);
    expect(queue).toHaveLength(2);
    expect(queue.find((f) => f.reason === "Poor work")).toMatchObject({ reporter: "A1 T.", pro: { name: `Flagged Pro ${RUN}` }, note: null });
    expect(queue.find((f) => f.reason === "Not true")?.note).toMatchObject({ text: "pretty good", author: "A2 T." });

    await db.from("flags").update({ status: "resolved" }).eq("id", proFlag!.id);
    expect((await openFlags(db)).filter((f) => f.pro?.id === p)).toHaveLength(1);
  });
});

describe("ban", () => {
  it("a banned user can't react, and an admin can't be banned", async () => {
    const p = await pro("Ban Test Pro", null);
    await setBanned(db, two.userId, true);
    expect(await react(two, p)).toMatchObject({ ok: false });
    await setBanned(db, two.userId, false);
    expect((await react(two, p)).ok).toBe(true);

    await db.from("profiles").update({ role: "admin" }).eq("id", three.userId);
    await setBanned(db, three.userId, true);
    const { data } = await db.from("profiles").select("banned").eq("id", three.userId).single();
    expect(data!.banned).toBe(false);
  });
});
