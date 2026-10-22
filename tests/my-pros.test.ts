// 11f "My pros": saved pros plus reacted pros, and the public share page. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { saveReaction } from "@/lib/reactions";
import { listMyPros } from "@/lib/my-pros";

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
let userId = "";

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  if (userId) await db.auth.admin.deleteUser(userId);
});

describe("My pros", () => {
  it("lists saved and reacted pros once each, skipping hidden pros", async () => {
    const { data: u } = await db.auth.admin.createUser({ email: `mypros-${RUN}@holler.test`, email_confirm: true });
    userId = u.user!.id;
    await joinHousehold(db, userId, { placeId: `TEST-${RUN}-me`, address: MARK, lat: 35.75, lng: -86.93, neighborhood: null }, {
      firstName: "Max",
      lastInitial: "T",
      privacy: "block",
    });
    const mk = async (name: string, status = "active") =>
      (await db.from("pros").insert({ name: `${name} ${RUN}`, service_area_text: MARK, status }).select("id").single()).data!.id as string;
    const savedOnly = await mk("Saved Only");
    const both = await mk("Saved And Loved");
    const reactedOnly = await mk("Reacted Only");
    const hidden = await mk("Hidden Pro", "hidden");

    await db.from("saved_pros").insert([savedOnly, both, hidden].map((pro_id) => ({ profile_id: userId, pro_id })));
    const actor = { userId, phone: null };
    await saveReaction(db, actor, { pro: { kind: "holler", proId: both }, category: "lawn", reaction: "love", note: "" });
    await saveReaction(db, actor, { pro: { kind: "holler", proId: reactedOnly }, category: "pool", reaction: "thumbs_up", note: "" });

    const list = await listMyPros(db, userId);
    const byName = Object.fromEntries(list.map((p) => [p.name.replace(` ${RUN}`, ""), p]));
    expect(Object.keys(byName).sort()).toEqual(["Reacted Only", "Saved And Loved", "Saved Only"]);
    expect(byName["Saved And Loved"]).toMatchObject({ saved: true, reaction: "love", category: "🌿 Lawn" });
    expect(byName["Saved Only"]).toMatchObject({ saved: true, reaction: null });
    expect(byName["Reacted Only"]).toMatchObject({ saved: false, reaction: "thumbs_up", category: "🏊 Pool" });
  });
});
