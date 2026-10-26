// "Ask us to add a pro": neighbor sends a request, admin creates the pro or declines. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import {
  addProFromRequest,
  adminVendorRequests,
  createVendorRequest,
  declineVendorRequest,
  MAX_VENDOR_REQUESTS_PER_DAY,
  myVendorRequests,
} from "@/lib/vendor-requests";

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
let neighbor = "";

beforeAll(async () => {
  const { data } = await db.auth.admin.createUser({ email: `vreq-${RUN}@holler.test`, email_confirm: true });
  neighbor = data.user!.id;
  await joinHousehold(db, neighbor, { placeId: `TEST-${RUN}-v`, address: MARK, lat: 35.7, lng: -86.9, neighborhood: null }, {
    firstName: "Vera",
    lastInitial: "T",
    privacy: "block",
  });
});

afterAll(async () => {
  await db.from("pros").delete().like("name", `%${RUN}%`);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
  if (neighbor) await db.auth.admin.deleteUser(neighbor); // requests go with the account
});

describe("vendor requests", () => {
  let reqId = "";

  it("needs a name and at least one service; details can include a phone or Instagram", async () => {
    expect(await createVendorRequest(db, neighbor, { name: "x", tags: ["nails"] })).toMatchObject({ ok: false });
    expect(await createVendorRequest(db, neighbor, { name: `Jess Lashes ${RUN}`, tags: [] })).toMatchObject({ ok: false });
    const r = await createVendorRequest(db, neighbor, {
      name: `Jess Lashes ${RUN}`,
      tags: ["lash-extensions", "not-real"],
      details: "Her IG is @jesslashes, 615-555-0199",
    });
    expect(r.ok).toBe(true);
    if (r.ok) reqId = r.id;
    const mine = await myVendorRequests(db, neighbor);
    expect(mine[0]).toMatchObject({ status: "waiting", tags: ["lash-extensions"], details: "Her IG is @jesslashes, 615-555-0199" });
    expect((await adminVendorRequests(db)).waiting.find((x) => x.id === reqId)).toMatchObject({ who: "Vera T." });
  });

  it("the admin creates the pro from the request, and the neighbor sees it added", async () => {
    const r = await addProFromRequest(db, neighbor, reqId, { name: `Jess Lashes ${RUN}`, tags: ["lash-extensions"], social: "@jesslashes" });
    expect(r).toMatchObject({ ok: true, requesterId: neighbor });
    if (!r.ok) return;
    const { data: pro } = await db.from("pros").select("tags, social_url, color").eq("id", r.proId).single();
    expect(pro).toMatchObject({ tags: ["lash-extensions"], social_url: "https://www.instagram.com/jesslashes" });
    expect(pro!.color).not.toBeNull();
    expect((await myVendorRequests(db, neighbor)).find((x) => x.id === reqId)).toMatchObject({ status: "added", proId: r.proId });
    // Handling it twice does nothing
    expect((await addProFromRequest(db, neighbor, reqId, { name: `Again ${RUN}`, tags: ["nails"] })).ok).toBe(false);
  });

  it("a declined request shows the reason", async () => {
    const r = await createVendorRequest(db, neighbor, { name: `Mystery Nails ${RUN}`, tags: ["nails"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await declineVendorRequest(db, r.id, "Couldn't find them")).ok).toBe(true);
    expect((await myVendorRequests(db, neighbor)).find((x) => x.id === r.id)).toMatchObject({ status: "declined", declineReason: "Couldn't find them" });
  });

  it(`limits requests to ${MAX_VENDOR_REQUESTS_PER_DAY} a day`, async () => {
    const r = await createVendorRequest(db, neighbor, { name: `One More ${RUN}`, tags: ["vet"] });
    expect(r.ok).toBe(true); // 3rd today
    expect(await createVendorRequest(db, neighbor, { name: `Too Many ${RUN}`, tags: ["vet"] })).toMatchObject({ ok: false });
  });
});
