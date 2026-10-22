// The Porch shows everything within 20 miles (redesign phase 3), with neighborhood bylines and distance.
// Phone-alert reach (1/3/5 mi) no longer changes what the Porch shows. Uses throwaway TEST data.
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

async function person(n: number, lat: number, neighborhood: string | null = null) {
  const { data, error } = await db.auth.admin.createUser({ email: `reach-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat, lng: -85.5, neighborhood, city: "Testville" }, {
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

describe("Porch reach", () => {
  it("shows posts and requests up to 20 miles away, whatever the alert reach, with neighborhood and distance", async () => {
    const poster = await person(1, 35.0, "Wades Grove");
    const viewer = await person(2, 35.15); // ~17 km ≈ 10 miles north
    const farAway = await person(3, 35.4); // ~44 km ≈ 28 miles
    await db.from("profiles").update({ reach_miles: 1 }).eq("id", viewer); // alert reach only

    const post = await createPost(db, poster, { kind: "curb_alert", body: "Free lawn mower, runs fine" });
    const ask = await createAsk(db, poster, { category: "roofing", timing: "asap", note: "Leak over the kitchen" });
    expect(post.ok && ask.ok).toBe(true);
    if (!post.ok || !ask.ok) return;

    const feed = await porchFeed(db, viewer, "all");
    expect(feed.find((f) => f.id === post.id)).toMatchObject({ type: "post", hood: "Wades Grove", distance: "10 mi" });
    expect(feed.find((f) => f.type === "ask" && f.id === ask.askId)).toMatchObject({ timing: "asap", note: "Leak over the kitchen", hood: "Wades Grove" });
    expect((await porchFeed(db, viewer, "pros")).some((f) => f.id === ask.askId)).toBe(true);
    expect((await porchFeed(db, viewer, "sales")).some((f) => f.id === ask.askId)).toBe(false);

    expect((await porchFeed(db, farAway, "all")).some((f) => f.id === post.id)).toBe(false);
    expect((await asksNear(db, farAway)).some((a) => a.id === ask.askId)).toBe(false);

    // No neighborhood known: the city shows instead
    const viewerPost = await createPost(db, viewer, { kind: "new_neighbor", body: "Hi all!" });
    expect(viewerPost.ok).toBe(true);
    if (viewerPost.ok) expect((await porchFeed(db, poster, "all")).find((f) => f.id === viewerPost.id)).toMatchObject({ hood: "Testville" });
  });

  it("search finds posts by their words", async () => {
    const a = await person(4, 36.0);
    const b = await person(5, 36.01);
    const p = await createPost(db, a, { kind: "lost_pet", body: "Gray tabby named Biscuit, last seen by the pool" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect((await porchFeed(db, b, "all", "biscuit")).map((f) => f.id)).toContain(p.id);
    expect((await porchFeed(db, b, "all", "trampoline")).map((f) => f.id)).not.toContain(p.id);
  });
});
