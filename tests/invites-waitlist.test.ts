// Pro invite links and the unlock-your-town waitlist. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { followInvite, getOrCreateInvite, inviteProId } from "@/lib/invites";
import { joinHousehold } from "@/lib/households";
import { saveReaction } from "@/lib/reactions";
import { mergePros } from "@/lib/admin";
import { joinWaitlist } from "@/lib/waitlist";

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
const TEST_ZIP = "00001"; // not a real ZIP
const userIds: string[] = [];

async function pro(name: string) {
  const { data } = await db.from("pros").insert({ name: `${name} ${RUN}`, service_area_text: MARK }).select("id").single();
  return data!.id as string;
}

afterAll(async () => {
  await db.from("waitlist").delete().eq("zip", TEST_ZIP);
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of userIds) await db.auth.admin.deleteUser(id);
});

describe("pro invite links", () => {
  it("gives each pro one link, counts visits, and points at the pro", async () => {
    const p = await pro("Invite Pro");
    const a = await getOrCreateInvite(db, p);
    const b = await getOrCreateInvite(db, p);
    expect(a?.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(b?.code).toBe(a?.code);

    expect(await followInvite(db, a!.code.toLowerCase())).toEqual({ proId: p, code: a!.code });
    await followInvite(db, a!.code);
    const { data } = await db.from("invites").select("uses").eq("code", a!.code).single();
    expect(data!.uses).toBe(2);
    expect(await followInvite(db, "NOPE00")).toBeNull();
  });

  it("follows merges: an old link lands on the kept pro", async () => {
    const dupe = await pro("Invite Dupe");
    const keep = await pro("Invite Keep");
    const inv = await getOrCreateInvite(db, dupe);
    await mergePros(db, dupe, keep);
    expect((await followInvite(db, inv!.code))?.proId).toBe(keep);
    expect(await inviteProId(db, inv!.code)).toBe(keep);
  });

  it("labels reactions that came through the pro's own link, and only those", async () => {
    const { data: u } = await db.auth.admin.createUser({ email: `invite-${RUN}@holler.test`, email_confirm: true });
    userIds.push(u.user!.id);
    await joinHousehold(db, u.user!.id, { placeId: `TEST-${RUN}-inv`, address: MARK, lat: 35.75, lng: -86.93, neighborhood: null }, {
      firstName: "Ivy",
      lastInitial: "T",
      privacy: "block",
    });
    const invited = await pro("Invited Pro");
    const other = await pro("Other Pro");
    const actor = { userId: u.user!.id, phone: null, inviteProId: invited };
    await saveReaction(db, actor, { pro: { kind: "holler", proId: invited }, category: "lawn", reaction: "love", note: "" });
    await saveReaction(db, actor, { pro: { kind: "holler", proId: other }, category: "lawn", reaction: "love", note: "" });
    const { data } = await db.from("vouches").select("pro_id, via_invite").eq("profile_id", u.user!.id);
    expect(data!.find((v) => v.pro_id === invited)?.via_invite).toBe(true);
    expect(data!.find((v) => v.pro_id === other)?.via_invite).toBe(false);
  });
});

describe("unlock-your-town waitlist", () => {
  it("adds people once per ZIP and counts them", async () => {
    const first = await joinWaitlist(db, { contact: `a-${RUN}@holler.test`, zip: TEST_ZIP, town: "Testville" });
    const second = await joinWaitlist(db, { contact: "(615) 555-0142", zip: TEST_ZIP, town: "" });
    const again = await joinWaitlist(db, { contact: `A-${RUN}@HOLLER.TEST`, zip: TEST_ZIP, town: "" });
    expect(first).toMatchObject({ ok: true, already: false });
    expect(second).toMatchObject({ ok: true, already: false });
    expect(again).toMatchObject({ ok: true, already: true });
    expect(again.ok && again.count).toBe(2);
  });

  it("rejects a bad ZIP or contact", async () => {
    expect(await joinWaitlist(db, { contact: "a@b.co", zip: "123", town: "" })).toMatchObject({ ok: false });
    expect(await joinWaitlist(db, { contact: "not a contact", zip: TEST_ZIP, town: "" })).toMatchObject({ ok: false });
  });
});
