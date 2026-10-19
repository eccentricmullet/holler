"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AlertPrefs = { asks: boolean; answers: boolean; porchDaily: boolean };
type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

// Saves which alerts the person wants, and this phone/browser's push address when they turn any on.
export async function saveAlerts(prefs: AlertPrefs, sub: Sub | null): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in first." };
  const db = createAdminClient();

  const { error } = await db
    .from("profiles")
    .update({ alert_asks: !!prefs.asks, alert_answers: !!prefs.answers, alert_porch_daily: !!prefs.porchDaily })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save that. Try again." };

  if (sub && /^https:\/\//.test(sub.endpoint) && sub.keys?.p256dh && sub.keys?.auth) {
    await db
      .from("push_subscriptions")
      .upsert({ endpoint: sub.endpoint, profile_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  }
  return { ok: true };
}

// Turning everything off forgets this phone/browser too
export async function forgetDevice(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("profile_id", user.id);
}
