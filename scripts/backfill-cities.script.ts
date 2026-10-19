// Fills in the city for homes saved before cities were stored. Safe to run again.
//   npx vitest run -c vitest.scripts.mts backfill-cities
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { it } from "vitest";
import { getAddressDetails } from "@/lib/places";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
process.env.GOOGLE_PLACES_API_KEY = env.GOOGLE_PLACES_API_KEY;
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

it("fills in missing cities", async () => {
  // Test homes are all around Spring Hill
  const { count: tests } = await db.from("households").update({ city: "Spring Hill" }, { count: "exact" }).eq("address", "TEST SEED").is("city", null);

  // Real homes: ask Google for the city of the saved address
  const { data: homes } = await db.from("households").select("id, address_place_id").is("city", null).neq("address", "TEST SEED");
  let real = 0;
  for (const h of homes ?? []) {
    if (!h.address_place_id) continue;
    try {
      const place = await getAddressDetails(h.address_place_id);
      if (place.city) {
        await db.from("households").update({ city: place.city }).eq("id", h.id);
        real++;
      }
    } catch {
      console.log("couldn't look up one home");
    }
  }
  console.log(`Cities filled in: ${tests ?? 0} test homes, ${real} real homes.`);
});
