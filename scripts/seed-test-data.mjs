// Adds clearly-marked TEST neighbors, pros and reactions around the owner's block for map testing.
//   node scripts/seed-test-data.mjs          add test data
//   node scripts/seed-test-data.mjs --clean  remove all test data
// Test users have @holler.test emails; test homes and pros are marked "TEST SEED". Never prints keys.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MARK = "TEST SEED";
const EMAIL_DOMAIN = "holler.test";

async function clean() {
  await db.from("pros").delete().eq("service_area_text", MARK);
  await db.from("households").delete().eq("address", MARK);
  let removed = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const seeds = data.users.filter((u) => u.email?.endsWith(`@${EMAIL_DOMAIN}`));
    for (const u of seeds) {
      await db.auth.admin.deleteUser(u.id);
      removed++;
    }
    if (data.users.length < 200) break;
  }
  console.log(`Removed test data (${removed} test users).`);
}

// Pretend businesses. 555-01xx numbers are reserved for fiction.
const PROS = [
  { name: "Greenway Lawn Care", cat: "lawn", phone: "+16155550101", weight: 7, love: 0.45 },
  { name: "Two Brothers Mowing", cat: "lawn", phone: "+16155550102", weight: 4, love: 0.2 },
  { name: "Rolling Hills Landscape", cat: "lawn", phone: "+16155550103", weight: 2, love: 0.5 },
  { name: "Crystal Clear Pools", cat: "pool", phone: "+16155550104", weight: 5, love: 0.4 },
  { name: "Blue Lagoon Pool Service", cat: "pool", phone: "+16155550105", weight: 2, love: 0.1 },
  { name: "Cool Breeze HVAC", cat: "hvac", phone: "+16155550106", weight: 5, love: 0.3 },
  { name: "Comfort Pro Heating & Air", cat: "hvac", phone: "+16155550107", weight: 3, love: 0.3 },
  { name: "BugOut Pest Control", cat: "pest", phone: "+16155550108", weight: 4, love: 0.25 },
  { name: "Spring Hill Plumbing Co", cat: "plumbing", phone: "+16155550109", weight: 3, love: 0.5 },
];
const NAMES = ["Amy", "Ben", "Cara", "Dan", "Eve", "Finn", "Gina", "Hank", "Ivy", "Jake", "Kim", "Leo",
  "Mia", "Nate", "Olive", "Pete", "Quinn", "Rosa", "Sam", "Tess", "Uma", "Vic", "Wes", "Zoe"];
const NOTES = ["Always on time.", "Fair price, great work.", "Saved our summer!", "Would hire again.", null, null];

// Deterministic randomness so reruns look the same
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

async function add() {
  const { data: owner, error: ownerErr } = await db
    .from("profiles")
    .select("household_id")
    .eq("role", "user")
    .order("created_at")
    .limit(1)
    .single();
  if (ownerErr || !owner) throw new Error("Sign up first so test data can go around your block.");

  const center = await ownerCenter(owner.household_id);
  const { data: cats } = await db.from("categories").select("id, slug");
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  const { data: pros, error: prosErr } = await db
    .from("pros")
    .insert(PROS.map((p) => ({ name: p.name, phone: p.phone, service_area_text: MARK })))
    .select("id, name");
  if (prosErr) throw prosErr;
  const proId = Object.fromEntries(pros.map((p) => [p.name, p.id]));

  let reactions = 0;
  for (let i = 0; i < NAMES.length; i++) {
    // Most neighbors within ~1.5 km, a few farther out
    const far = i % 6 === 5;
    const dist = (far ? 1800 + rand() * 2500 : 150 + rand() * 1350) / 111320;
    const angle = rand() * Math.PI * 2;
    const lat = center.lat + dist * Math.sin(angle);
    const lng = center.lng + (dist * Math.cos(angle)) / Math.cos((center.lat * Math.PI) / 180);

    const { data: user, error: userErr } = await db.auth.admin.createUser({
      email: `seed-${i + 1}@${EMAIL_DOMAIN}`,
      email_confirm: true,
    });
    if (userErr) throw userErr;

    const { data: home, error: homeErr } = await db
      .from("households")
      .insert({ address: MARK, location: `SRID=4326;POINT(${lng} ${lat})` })
      .select("id")
      .single();
    if (homeErr) throw homeErr;

    const { error: profErr } = await db.from("profiles").insert({
      id: user.user.id,
      household_id: home.id,
      first_name: NAMES[i],
      last_initial: "T",
      phone_verified: true,
      privacy: i % 8 === 7 ? "hidden" : "block",
    });
    if (profErr) throw profErr;

    // Each neighbor reacts to one pro in 2-3 categories, picked by popularity
    const myCats = [...new Set(PROS.map((p) => p.cat))].filter(() => rand() < 0.55);
    for (const cat of myCats) {
      const options = PROS.filter((p) => p.cat === cat);
      const total = options.reduce((s, p) => s + p.weight, 0);
      let r = rand() * total;
      const pick = options.find((p) => (r -= p.weight) < 0) ?? options[0];
      const { error: vErr } = await db.from("vouches").insert({
        household_id: home.id,
        profile_id: user.user.id,
        pro_id: proId[pick.name],
        category_id: catId[cat],
        reaction: rand() < pick.love ? "love" : "thumbs_up",
        note: NOTES[Math.floor(rand() * NOTES.length)],
      });
      if (vErr) throw vErr;
      reactions++;
    }
  }
  console.log(`Added ${PROS.length} test pros, ${NAMES.length} test neighbors, ${reactions} test reactions.`);
}

// The owner's fuzzed block, read back as coordinates (never the exact house).
async function ownerCenter(householdId) {
  const { data, error } = await db.from("households").select("display_location").eq("id", householdId).single();
  if (error) throw error;
  const g = data.display_location;
  if (g && typeof g === "object" && Array.isArray(g.coordinates)) return { lng: g.coordinates[0], lat: g.coordinates[1] };
  // PostgREST returns geography as hex EWKB: 01 01000020 E6100000 <x double> <y double>
  const buf = Buffer.from(g, "hex");
  const little = buf[0] === 1;
  const hasSrid = (little ? buf.readUInt32LE(1) : buf.readUInt32BE(1)) & 0x20000000;
  const off = 5 + (hasSrid ? 4 : 0);
  const read = (o) => (little ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  return { lng: read(off), lat: read(off + 8) };
}

if (process.argv.includes("--clean")) await clean();
else {
  await clean();
  await add();
}
