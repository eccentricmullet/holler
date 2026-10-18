// 11h Ask the neighborhood. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { answerAsk, asksNear, createAsk, myAsks, MAX_ASKS_PER_DAY } from "@/lib/asks";
import type { Actor } from "@/lib/reactions";

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

// ~0.009° latitude ≈ 1 km
async function person(n: number, lat: number, name: string): Promise<Actor> {
  const { data, error } = await db.auth.admin.createUser({ email: `asks-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat, lng: -86.5, neighborhood: null }, {
    firstName: name,
    lastInitial: "T",
    privacy: "block",
  });
  return { userId: data.user.id, phone: null };
}

let asker: Actor, near: Actor, far: Actor;
let proId = "";
beforeAll(async () => {
  asker = await person(1, 35.5, "Asha");
  near = await person(2, 35.505, "Nico"); // ~550 m away
  far = await person(3, 35.55, "Faye"); // ~5.5 km away
  const { data } = await db.from("pros").insert({ name: `Ask Plumber ${RUN}`, phone: "+16155550133", service_area_text: MARK }).select("id").single();
  proId = data!.id;
});

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
});

describe("Ask the neighborhood", () => {
  let askId = "";

  it("creates an ask once per category (asking again reuses it)", async () => {
    const a = await createAsk(db, asker.userId, "plumbing");
    const b = await createAsk(db, asker.userId, "plumbing");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.askId).toBe(a.askId);
    if (a.ok) askId = a.askId;
  });

  it("neighbors within a mile see it; farther ones and the asker don't", async () => {
    expect((await asksNear(db, near.userId)).find((x) => x.id === askId)).toMatchObject({ who: "Asha T.", categoryName: "Plumbing", answers: 0 });
    expect((await asksNear(db, far.userId)).find((x) => x.id === askId)).toBeUndefined();
    expect((await asksNear(db, asker.userId)).find((x) => x.id === askId)).toBeUndefined();
  });

  it("answering with a pro records the answer AND adds a reaction in the ask's category", async () => {
    const r = await answerAsk(db, near, askId, { pro: { kind: "holler", proId }, reaction: "love", note: "" });
    expect(r).toMatchObject({ ok: true, proId, answeredFor: "Asha T." });
    const { data: v } = await db.from("vouches").select("reaction, categories(slug)").eq("profile_id", near.userId).eq("pro_id", proId).single();
    expect(v).toMatchObject({ reaction: "love", categories: { slug: "plumbing" } });
    expect((await asksNear(db, near.userId)).find((x) => x.id === askId)).toMatchObject({ answers: 1, answeredByMe: true });
  });

  it("the asker sees the suggested pro", async () => {
    const mine = (await myAsks(db, asker.userId)).find((x) => x.id === askId);
    expect(mine?.suggestions).toEqual([{ proId, name: `Ask Plumber ${RUN}`, logoUrl: null, count: 1 }]);
  });

  it("you can't answer your own ask", async () => {
    const r = await answerAsk(db, asker, askId, { pro: { kind: "holler", proId }, reaction: "love", note: "" });
    expect(r.ok).toBe(false);
  });

  it(`limits new asks to ${MAX_ASKS_PER_DAY} a day`, async () => {
    const results = [];
    for (const slug of ["lawn", "pool", "pest", "roofing"]) results.push(await createAsk(db, asker.userId, slug));
    // plumbing already counted as one today
    expect(results.filter((r) => r.ok)).toHaveLength(MAX_ASKS_PER_DAY - 1);
    expect(results.at(-1)).toMatchObject({ ok: false });
  });
});
