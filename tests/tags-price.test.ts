// 11b quick tags and 11c price hint. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { saveReaction, type Actor } from "@/lib/reactions";
import { getProPage } from "@/lib/pros";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
// getProPage reads these the way the app does
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const db: SupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const MARK = "TEST SEED";
const RUN = Math.random().toString(36).slice(2, 8);
const userIds: string[] = [];

async function person(n: number): Promise<Actor> {
  const { data, error } = await db.auth.admin.createUser({ email: `tags-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat: 35.75, lng: -86.93, neighborhood: null }, {
    firstName: `T${n}`,
    lastInitial: "T",
    privacy: "block",
  });
  return { userId: data.user.id, phone: null };
}

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
});

describe("quick tags and price", () => {
  it("saves known tags and a valid price, drops anything else", async () => {
    const a = await person(1);
    const { data: p } = await db.from("pros").insert({ name: `Tag Pro ${RUN}`, service_area_text: MARK }).select("id").single();
    const r = await saveReaction(db, a, {
      pro: { kind: "holler", proId: p!.id },
      category: "lawn",
      reaction: "love",
      note: "",
      tags: ["fair_price", "on_time", "fair_price", "made_up_tag"],
      price: 7,
    });
    expect(r.ok).toBe(true);
    const { data } = await db.from("vouches").select("tags, price").eq("pro_id", p!.id).single();
    expect(data!.tags.sort()).toEqual(["fair_price", "on_time"]);
    expect(data!.price).toBeNull();
  });

  it("the pro page counts tags and shows the typical price", async () => {
    const { data: p } = await db.from("pros").insert({ name: `Count Pro ${RUN}`, service_area_text: MARK }).select("id").single();
    const people = [await person(2), await person(3), await person(4)];
    const answers: { tags: string[]; price: number | null }[] = [
      { tags: ["fair_price", "on_time"], price: 2 },
      { tags: ["fair_price"], price: 3 },
      { tags: ["clean_work"], price: 2 },
    ];
    for (let i = 0; i < people.length; i++) {
      await saveReaction(db, people[i], { pro: { kind: "holler", proId: p!.id }, category: "lawn", reaction: "thumbs_up", note: "", ...answers[i] });
    }
    const result = await getProPage(p!.id, { lat: 35.75, lng: -86.93 });
    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.pro.tagCounts[0]).toMatchObject({ id: "fair_price", count: 2 });
    expect(result.pro.tagCounts.map((t) => t.id).sort()).toEqual(["clean_work", "fair_price", "on_time"]);
    expect(result.pro.price).toEqual({ level: 2, from: 3 });
  });
});
