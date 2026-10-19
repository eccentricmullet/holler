// Gives every pro without a color their own one (step 11j). Safe to run again.
//   node scripts/backfill-colors.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { backfillProColors } from "../src/lib/pro-colors.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const n = await backfillProColors(db);
console.log(`Gave ${n} pros their own color.`);
