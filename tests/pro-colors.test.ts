// 11j: pros in the same category always get different colors. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { saveReaction } from "@/lib/reactions";
import { PRO_COLORS } from "@/lib/pro-colors";

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

describe("pro colors", () => {
  it("gives each new pro in a category a color no other pro there uses, and no greens", async () => {
    const { data: u } = await db.auth.admin.createUser({ email: `colors-${RUN}@holler.test`, email_confirm: true });
    userId = u.user!.id;
    await joinHousehold(db, userId, { placeId: `TEST-${RUN}-c`, address: MARK, lat: 35.75, lng: -86.93, neighborhood: null }, {
      firstName: "Cole",
      lastInitial: "T",
      privacy: "block",
    });

    // Florist is empty in test data, so these 4 are the only florists
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await db.from("pros").insert({ name: `Color Florist ${i} ${RUN}`, service_area_text: MARK }).select("id").single();
      ids.push(data!.id);
      const r = await saveReaction(db, { userId, phone: null }, { pro: { kind: "holler", proId: data!.id }, category: "florist", reaction: "thumbs_up", note: "" });
      expect(r.ok).toBe(true);
    }
    const { data: pros } = await db.from("pros").select("color").in("id", ids);
    const colors = pros!.map((p) => p.color);
    expect(new Set(colors).size).toBe(4);
    for (const c of colors) expect(PRO_COLORS).toContain(c);
    for (const c of PRO_COLORS) expect(c.toLowerCase()).not.toMatch(/^#(2bb24c|178a35|7ed957)$/);
  });
});
