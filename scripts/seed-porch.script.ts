// Adds a few TEST Porch posts from the test neighbors (removed with the rest of the test data).
//   npx vitest run -c vitest.scripts.mts seed-porch
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { it } from "vitest";
import { createPost } from "@/lib/porch";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

it("adds test Porch posts", async () => {
const { data: people } = await db.from("profiles").select("id, first_name").eq("last_initial", "T").in("first_name", ["Amy", "Ben", "Cara", "Dan", "Eve", "Finn"]);
const by = Object.fromEntries((people ?? []).map((p) => [p.first_name, p.id]));
const { data: greenway } = await db.from("pros").select("id").eq("name", "Greenway Lawn Care").maybeSingle();
const saturday = new Date();
saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7));

const posts = [
  [by.Amy, { kind: "curb_alert", body: "Free kids bike and a bookshelf at the curb. First come first served!" }],
  [by.Ben, { kind: "garage_sale", body: "Multi-family garage sale: tools, baby gear, furniture. 7am to noon.", happensOn: saturday.toLocaleDateString("en-CA") }],
  [by.Cara, { kind: "lost_pet", body: "Our tabby Milo slipped out last night near the pond. Very friendly, orange collar." }],
  [by.Dan, { kind: "heads_up", topic: "roads", body: "Main St is down to one lane by the library for paving this week." }],
  [by.Eve, { kind: "just_hired", body: "Greenway did our front beds today. Looks amazing and they cleaned up everything!", proId: greenway?.id ?? null }],
  [by.Finn, { kind: "new_neighbor", body: "Just moved in on Chester Ave with two kids and a golden retriever. Say hi if you see us!" }],
] as const;

let n = 0;
for (const [who, post] of posts) {
  if (!who) continue;
  const r = await createPost(db, who, post);
  if (r.ok) n++;
  else console.log("skipped:", r.error);
}
console.log(`Added ${n} test Porch posts.`);
});
