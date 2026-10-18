// Deleting an account removes everything about the person. Uses throwaway TEST accounts.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { deleteAccountData } from "@/lib/account";
import { joinHousehold } from "@/lib/households";
import { saveReaction } from "@/lib/reactions";

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
const leftovers: string[] = [];

async function person(n: number, placeId: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `delete-${RUN}-${n}@holler.test`, email_confirm: true });
  if (error) throw error;
  leftovers.push(data.user.id);
  const r = await joinHousehold(db, data.user.id, { placeId, address: MARK, lat: 35.75, lng: -86.93, neighborhood: null }, {
    firstName: `D${n}`,
    lastInitial: "T",
    privacy: "block",
  });
  expect(r.ok).toBe(true);
  return data.user.id;
}

afterAll(async () => {
  await db.from("pros").delete().eq("service_area_text", MARK).like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  for (const id of leftovers) await db.auth.admin.deleteUser(id);
});

describe("delete account", () => {
  it("removes reactions, flags, profile, login and an empty home", async () => {
    const id = await person(1, `TEST-${RUN}-solo`);
    const { data: pro } = await db
      .from("pros")
      .insert({ name: `Delete Test Pro ${RUN}`, phone: "+16155550777", service_area_text: MARK })
      .select("id")
      .single();
    const r = await saveReaction(db, { userId: id, phone: null }, { pro: { kind: "holler", proId: pro!.id }, category: "lawn", reaction: "love", note: "great" });
    expect(r.ok).toBe(true);
    await db.from("flags").insert({ pro_id: pro!.id, profile_id: id, reason: "test" });
    const { data: before } = await db.from("profiles").select("household_id").eq("id", id).single();

    expect((await deleteAccountData(db, id)).ok).toBe(true);

    const count = async (table: string, col: string, val: string) =>
      (await db.from(table).select("id", { count: "exact", head: true }).eq(col, val)).count;
    expect(await count("vouches", "profile_id", id)).toBe(0);
    expect(await count("flags", "profile_id", id)).toBe(0);
    expect(await count("profiles", "id", id)).toBe(0);
    expect(await count("households", "id", before!.household_id)).toBe(0);
    const { data: login } = await db.auth.admin.getUserById(id);
    expect(login.user).toBeNull();
  });

  it("keeps the home when someone else in the household still has an account", async () => {
    const place = `TEST-${RUN}-shared`;
    const a = await person(2, place);
    const b = await person(3, place);
    const { data: before } = await db.from("profiles").select("household_id").eq("id", a).single();
    expect((await deleteAccountData(db, a)).ok).toBe(true);
    const { count } = await db.from("households").select("id", { count: "exact", head: true }).eq("id", before!.household_id);
    expect(count).toBe(1);
    const { data: stillThere } = await db.from("profiles").select("id").eq("id", b).single();
    expect(stillThere?.id).toBe(b);
  });
});
