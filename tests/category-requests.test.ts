// "Suggest a service": neighbor asks for a new category, admin adds it or declines. Uses throwaway TEST data.
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { joinHousehold } from "@/lib/households";
import {
  addCategoryFromRequest,
  adminCategoryRequests,
  createCategoryRequest,
  declineCategoryRequest,
  MAX_CATEGORY_REQUESTS_PER_DAY,
  myCategoryRequests,
  slugify,
} from "@/lib/category-requests";

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
const NAME = `Test washing ${RUN}`;
let neighbor = "";
let originalOrder: { slug: string; sort_order: number }[] = [];

beforeAll(async () => {
  const { data: cats } = await db.from("categories").select("slug, sort_order");
  originalOrder = cats ?? [];
  const { data } = await db.auth.admin.createUser({ email: `creq-${RUN}@holler.test`, email_confirm: true });
  neighbor = data.user!.id;
  await joinHousehold(db, neighbor, { placeId: `TEST-${RUN}-c`, address: MARK, lat: 35.7, lng: -86.9, neighborhood: null }, {
    firstName: "Cora",
    lastInitial: "T",
    privacy: "block",
  });
});

afterAll(async () => {
  if (neighbor) await db.auth.admin.deleteUser(neighbor); // requests go with the account
  await db.from("categories").delete().eq("slug", slugify(NAME));
  // Put the real services back in their original order
  for (const c of originalOrder) await db.from("categories").update({ sort_order: c.sort_order }).eq("slug", c.slug);
  await db.from("households").delete().eq("address", MARK).like("address_place_id", `TEST-${RUN}-%`);
});

describe("service requests", () => {
  let reqId = "";

  it("turns names into slugs", () => {
    expect(slugify("Pressure Washing & Sealing")).toBe("pressure-washing-and-sealing");
    expect(slugify("  Dog walking! ")).toBe("dog-walking");
  });

  it("needs a name, and points to services that already exist", async () => {
    expect(await createCategoryRequest(db, neighbor, { name: "x" })).toMatchObject({ ok: false });
    expect(await createCategoryRequest(db, neighbor, { name: "plumbing" })).toMatchObject({ ok: false, error: expect.stringContaining("already") });
    const r = await createCategoryRequest(db, neighbor, { name: NAME, details: "For my driveway" });
    expect(r.ok).toBe(true);
    if (r.ok) reqId = r.id;
    expect((await myCategoryRequests(db, neighbor))[0]).toMatchObject({ status: "waiting", name: NAME, details: "For my driveway" });
    expect((await adminCategoryRequests(db)).waiting.find((x) => x.id === reqId)).toMatchObject({ who: "Cora T." });
  });

  it("the admin adds it at the end of its group, and the neighbor sees it added", async () => {
    expect(await addCategoryFromRequest(db, reqId, { name: NAME, icon: "abc", section: "Outside" })).toMatchObject({ ok: false });
    const r = await addCategoryFromRequest(db, reqId, { name: NAME, icon: "🧽", section: "Outside" });
    expect(r).toMatchObject({ ok: true, slug: slugify(NAME), requesterId: neighbor });
    const { data: cats } = await db.from("categories").select("slug, section, icon, sort_order").order("sort_order");
    const i = cats!.findIndex((c) => c.slug === slugify(NAME));
    expect(cats![i]).toMatchObject({ section: "Outside", icon: "🧽" });
    expect(cats![i - 1].section).toBe("Outside");
    if (cats![i + 1]) expect(cats![i + 1].section).not.toBe("Outside");
    expect((await myCategoryRequests(db, neighbor)).find((x) => x.id === reqId)).toMatchObject({ status: "added", categorySlug: slugify(NAME) });
    // Handling it twice does nothing
    expect((await addCategoryFromRequest(db, reqId, { name: `Again ${RUN}`, icon: "🧽", section: "Outside" })).ok).toBe(false);
  });

  it("a declined request shows the reason", async () => {
    const r = await createCategoryRequest(db, neighbor, { name: `Mystery service ${RUN}` });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await declineCategoryRequest(db, r.id, "Use Handyman for this one")).ok).toBe(true);
    expect((await myCategoryRequests(db, neighbor)).find((x) => x.id === r.id)).toMatchObject({ status: "declined", declineReason: "Use Handyman for this one" });
  });

  it(`limits requests to ${MAX_CATEGORY_REQUESTS_PER_DAY} a day`, async () => {
    expect((await createCategoryRequest(db, neighbor, { name: `One more ${RUN}` })).ok).toBe(true); // 3rd today
    expect(await createCategoryRequest(db, neighbor, { name: `Too many ${RUN}` })).toMatchObject({ ok: false });
  });
});
