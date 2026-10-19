// Reach (1, 3 or 5 miles) decides how far The Porch and asks look. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { createPost, porchFeed } from "@/lib/porch";
import { asksNear, createAsk } from "@/lib/asks";

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

async function person(n: number, lat: number) {
  const { data, error } = await db.auth.admin.createUser({ email: `reach-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat, lng: -85.5, neighborhood: null, city: "Testville" }, {
    firstName: `R${n}`,
    lastInitial: "T",
    privacy: "block",
  });
  return data.user.id;
}

afterAll(async () => {
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of ids) await db.auth.admin.deleteUser(id);
});

describe("reach", () => {
  it("2.5 miles away: hidden at 1 mile, shown at 3 (the default) and 5", async () => {
    const poster = await person(1, 35.0);
    const viewer = await person(2, 35.036); // ~4 km ≈ 2.5 miles north
    const post = await createPost(db, poster, { kind: "curb_alert", body: "Free lawn mower, runs fine" });
    const ask = await createAsk(db, poster, "roofing");
    expect(post.ok && ask.ok).toBe(true);
    const sees = async () => ({
      post: (await porchFeed(db, viewer, "all")).some((f) => post.ok && f.id === post.id),
      ask: (await asksNear(db, viewer)).some((a) => ask.ok && a.id === ask.askId),
    });

    expect(await sees()).toEqual({ post: true, ask: true }); // default 3 miles
    await db.from("profiles").update({ reach_miles: 1 }).eq("id", viewer);
    expect(await sees()).toEqual({ post: false, ask: false });
    await db.from("profiles").update({ reach_miles: 5 }).eq("id", viewer);
    expect(await sees()).toEqual({ post: true, ask: true });

    const { data: home } = await db.from("profiles").select("households(city)").eq("id", viewer).single();
    expect(home).toMatchObject({ households: { city: "Testville" } });
  });
});
