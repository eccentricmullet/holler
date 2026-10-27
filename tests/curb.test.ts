// Redesign phase 4: The Curb. Listing, the 20-mile feed and filters, "I'm interested", Mark as gone, reports. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import { PORCH_BUCKET } from "@/lib/porch";
import { createCurbItem, curbFeed, curbItem, markGone, myCurbItems, reportCurbItem, setInterest } from "@/lib/curb";

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
// A 1x1 PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")).buffer;
const photo = { bytes: PNG, type: "image/png" };
const users: Record<string, string> = {};

async function neighbor(key: string, lat: number, lng: number, firstName: string, phone?: string) {
  const { data } = await db.auth.admin.createUser({ email: `curb-${key}-${RUN}@holler.test`, email_confirm: true, ...(phone ? { phone, phone_confirm: true } : {}) });
  users[key] = data.user!.id;
  await joinHousehold(db, users[key], { placeId: `TEST-${RUN}-${key}`, address: MARK, lat, lng, neighborhood: "Test Hollow" }, {
    firstName,
    lastInitial: "T",
    privacy: "block",
  });
}

beforeAll(async () => {
  await neighbor("seller", 35.75, -86.93, "Sally");
  // A made-up number in the 555-01xx range set aside for fiction
  await neighbor("buyer", 35.76, -86.94, "Bo", `1615555${String(Math.floor(Math.random() * 100)).padStart(2, "0")}01`.slice(0, 11));
  await neighbor("far", 36.4, -86.93, "Faye"); // about 45 miles away
});

afterAll(async () => {
  const { data } = await db.from("curb_items").select("photo_paths").in("profile_id", Object.values(users));
  const photos = (data ?? []).flatMap((r) => r.photo_paths as string[]);
  if (photos.length) await db.storage.from(PORCH_BUCKET).remove(photos);
  for (const id of Object.values(users)) await db.auth.admin.deleteUser(id); // items, interest and reports go with the account
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
});

describe("The Curb", () => {
  let couch = "";
  let drill = "";

  it("needs a title and a photo, and keeps phone numbers out", async () => {
    expect(await createCurbItem(db, users.seller, { title: "Couch", price: 0, kind: "furniture", photos: [] })).toMatchObject({ ok: false });
    expect(await createCurbItem(db, users.seller, { title: "x", price: 0, kind: "furniture", photos: [photo] })).toMatchObject({ ok: false });
    expect(await createCurbItem(db, users.seller, { title: "Couch", note: "Call 615-555-0199", price: 0, kind: "furniture", photos: [photo] })).toMatchObject({
      ok: false,
    });
    expect(await createCurbItem(db, users.seller, { title: "Couch", price: 0, kind: "furniture", photos: [photo, photo, photo, photo, photo] })).toMatchObject({
      ok: false,
    });
    const a = await createCurbItem(db, users.seller, { title: `Gray couch ${RUN}`, note: "Some wear, very comfy", price: 0, kind: "furniture", photos: [photo, photo] });
    const b = await createCurbItem(db, users.seller, { title: `Cordless drill ${RUN}`, price: 40, kind: "tools", photos: [photo] });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok) couch = a.id;
    if (b.ok) drill = b.id;
  });

  it("shows items within 20 miles, with filters", async () => {
    const mine = (await curbFeed(db, users.buyer)).filter((c) => c.title.includes(RUN));
    expect(mine.map((c) => c.title)).toEqual([`Cordless drill ${RUN}`, `Gray couch ${RUN}`]);
    expect(mine[1]).toMatchObject({ priceLabel: "Free", hood: "Test Hollow", mine: false });
    expect(mine[1].photoUrl).toContain(`curb/${users.seller}/`);
    const free = (await curbFeed(db, users.buyer, "free")).filter((c) => c.title.includes(RUN));
    expect(free.map((c) => c.id)).toEqual([couch]);
    expect((await curbFeed(db, users.buyer, "under25")).some((c) => c.id === drill)).toBe(false);
    expect((await curbFeed(db, users.buyer, "tools")).some((c) => c.id === drill)).toBe(true);
    expect((await curbFeed(db, users.buyer, "all", "drill")).some((c) => c.id === drill)).toBe(true);
    expect((await curbFeed(db, users.far)).some((c) => c.title.includes(RUN))).toBe(false);
    expect(await curbItem(db, users.far, couch)).toBeNull();
  });

  it("I'm interested alerts the seller once, and the seller sees who with their number", async () => {
    const first = await setInterest(db, users.buyer, couch, true);
    expect(first).toMatchObject({ ok: true, alert: { sellerId: users.seller } });
    expect(await setInterest(db, users.buyer, couch, true)).toMatchObject({ ok: true, alert: null }); // no second alert
    expect(await setInterest(db, users.seller, couch, true)).toMatchObject({ ok: false }); // not your own

    const buyerView = await curbItem(db, users.buyer, couch);
    expect(buyerView).toMatchObject({ iAmInterested: true, interestCount: 1, interested: [], who: "Sally T.", photoUrls: [expect.any(String), expect.any(String)] });
    const sellerView = await curbItem(db, users.seller, couch);
    expect(sellerView!.interested).toHaveLength(1);
    expect(sellerView!.interested[0]).toMatchObject({ who: "Bo T." });
    expect(sellerView!.interested[0].phone).toMatch(/^\+1615555\d{4}$/);
    expect((await myCurbItems(db, users.seller)).find((i) => i.id === couch)).toMatchObject({ live: true, interested: 1 });

    expect(await setInterest(db, users.buyer, couch, false)).toMatchObject({ ok: true });
    expect((await curbItem(db, users.seller, couch))!.interested).toHaveLength(0);
  });

  it("Mark as gone takes it off the Curb right away", async () => {
    expect((await markGone(db, users.buyer, drill)).ok).toBe(false); // only the seller
    expect((await markGone(db, users.seller, drill)).ok).toBe(true);
    expect((await curbFeed(db, users.buyer)).some((c) => c.id === drill)).toBe(false);
    expect((await myCurbItems(db, users.seller)).find((i) => i.id === drill)).toMatchObject({ live: false });
    expect(await setInterest(db, users.buyer, drill, true)).toMatchObject({ ok: false });
  });

  it("reports from neighbors are recorded (3 homes hide an item)", async () => {
    expect(await reportCurbItem(db, users.seller, couch, "spam")).toMatchObject({ ok: false }); // not your own
    expect(await reportCurbItem(db, users.buyer, couch, "spam")).toMatchObject({ ok: true, hidden: false });
  });
});
