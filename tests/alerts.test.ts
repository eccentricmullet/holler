// 11l opt-in alerts: who gets which alert. Uses throwaway TEST data. (Doesn't send real alerts.)
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { answerAsk, createAsk } from "@/lib/asks";
import { createPost } from "@/lib/porch";
import { answerRecipients, dailyPorchAlerts, newAskRecipients } from "@/lib/alerts";

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

async function person(n: number, lat: number, alerts: { asks?: boolean; answers?: boolean; porch?: boolean }) {
  const { data, error } = await db.auth.admin.createUser({ email: `alerts-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  await joinHousehold(db, data.user.id, { placeId: `TEST-${RUN}-${n}`, address: MARK, lat, lng: -85.9, neighborhood: null }, {
    firstName: `L${n}`,
    lastInitial: "T",
    privacy: "block",
  });
  await db
    .from("profiles")
    .update({ alert_asks: !!alerts.asks, alert_answers: !!alerts.answers, alert_porch_daily: !!alerts.porch })
    .eq("id", data.user.id);
  return data.user.id;
}

let asker = "", nearOn = "", nearOff = "", farOn = "";
beforeAll(async () => {
  asker = await person(1, 35.2, { answers: true });
  nearOn = await person(2, 35.205, { asks: true, porch: true }); // ~550 m, opted in
  nearOff = await person(3, 35.206, {}); // nearby, never opted in
  farOn = await person(4, 35.6, { asks: true, porch: true }); // ~44 km, past the 20-mile Porch
});

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of ids) await db.auth.admin.deleteUser(id);
});

describe("opt-in alerts", () => {
  it("a new ask alerts only opted-in neighbors within a mile, never the asker", async () => {
    const a = await createAsk(db, asker, "pool");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const who = await newAskRecipients(db, a.askId);
    expect(who?.ids).toEqual([nearOn]);
    expect(who?.alert).toMatchObject({ title: "A neighbor needs a pool pro", url: `/react?ask=${a.askId}` });
    expect(JSON.stringify(who?.alert)).not.toMatch(/L1|T\.|35\./); // no names or locations

    const { data: pro } = await db.from("pros").insert({ name: `Alert Pool ${RUN}`, service_area_text: MARK }).select("id").single();
    await answerAsk(db, { userId: nearOn, phone: null }, a.askId, { pro: { kind: "holler", proId: pro!.id }, reaction: "love", note: "" });
    const back = await answerRecipients(db, a.askId);
    expect(back).toMatchObject({ ids: [asker], alert: { title: "A neighbor answered your ask", url: "/asks" } });
  });

  it("the daily Porch roundup goes to opted-in people with new posts nearby, and skips quiet areas", async () => {
    const p = await createPost(db, asker, { kind: "curb_alert", body: "Free patio chairs at the curb" });
    expect(p.ok).toBe(true);
    const alerts = await dailyPorchAlerts(db);
    const mine = alerts.find((a) => a.id === nearOn);
    expect(mine?.alert).toMatchObject({ url: "/porch" });
    expect(mine?.alert.title).toMatch(/new on The Porch/);
    expect(alerts.find((a) => a.id === farOn)).toBeUndefined(); // far away: nothing new near them
    expect(alerts.find((a) => a.id === nearOff)).toBeUndefined(); // never opted in
  });
});
