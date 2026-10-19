import type { SupabaseClient } from "@supabase/supabase-js";
import { metersBetween, parsePoint } from "@/lib/geo";
import { reachMeters } from "@/lib/reach";
import { porchFeed } from "@/lib/porch";
import { KINDS } from "@/lib/porch-kinds";
import { aCategoryPro } from "@/lib/words";
import type { Alert } from "@/lib/push";

// Who should get which opt-in alert (11l). Only people who turned that alert on.

type Row = { id: string; household_id: string | null; reach_miles: number | null; households: { display_location: unknown } | null };

// New ask: opted-in neighbors whose reach (1, 3 or 5 miles) covers the asker's block (not the asker's home).
export async function newAskRecipients(db: SupabaseClient, askId: string): Promise<{ ids: string[]; alert: Alert } | null> {
  const { data: ask } = await db
    .from("asks")
    .select("id, household_id, categories(name), households!asks_household_id_fkey(display_location)")
    .eq("id", askId)
    .maybeSingle();
  if (!ask) return null;
  const here = parsePoint((ask.households as unknown as { display_location: unknown } | null)?.display_location);
  if (!here) return null;
  const { data } = await db
    .from("profiles")
    .select("id, household_id, reach_miles, households(display_location)")
    .eq("alert_asks", true)
    .eq("banned", false)
    .neq("household_id", ask.household_id);
  const ids = ((data ?? []) as unknown as Row[])
    .filter((p) => {
      const at = parsePoint(p.households?.display_location);
      return at && metersBetween(at, here) <= reachMeters(p.reach_miles); // their own reach
    })
    .map((p) => p.id);
  const name = (ask.categories as unknown as { name: string } | null)?.name ?? "local";
  return { ids, alert: { title: `A neighbor needs ${aCategoryPro(name)}`, body: "Know a good one? Tap to share.", url: `/react?ask=${ask.id}`, tag: `ask-${ask.id}` } };
}

// New answer: the asker, if they want answer alerts.
export async function answerRecipients(db: SupabaseClient, askId: string): Promise<{ ids: string[]; alert: Alert } | null> {
  const { data: ask } = await db.from("asks").select("id, profile_id, categories(name), profiles!asks_profile_id_fkey(alert_answers)").eq("id", askId).maybeSingle();
  if (!ask) return null;
  const wants = (ask.profiles as unknown as { alert_answers: boolean } | null)?.alert_answers;
  const name = (ask.categories as unknown as { name: string } | null)?.name ?? "";
  return {
    ids: wants ? [ask.profile_id] : [],
    alert: { title: "A neighbor answered your ask", body: `They recommended someone for ${name.toLowerCase() === "hvac" ? "HVAC" : name.toLowerCase()}.`, url: "/asks", tag: `answers-${ask.id}` },
  };
}

// Daily roundup: for each opted-in person, posts near them in the last day (skips quiet days).
export async function dailyPorchAlerts(db: SupabaseClient): Promise<{ id: string; alert: Alert }[]> {
  const { data } = await db.from("profiles").select("id").eq("alert_porch_daily", true).eq("banned", false);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const out: { id: string; alert: Alert }[] = [];
  for (const p of data ?? []) {
    const feed = await porchFeed(db, p.id, "all");
    const fresh = feed.filter((f) => f.type === "post" && !f.mine && f.createdAt > since);
    if (!fresh.length) continue;
    const kinds = [...new Set(fresh.map((f) => (f.type === "post" ? KINDS[f.kind].label.toLowerCase() : "")))].slice(0, 3);
    out.push({
      id: p.id,
      alert: {
        title: `${fresh.length} new on The Porch`,
        body: kinds.join(", ").replace(/^./, (c) => c.toUpperCase()),
        url: "/porch",
        tag: "porch-daily",
      },
    });
  }
  return out;
}
