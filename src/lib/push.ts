import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

// Sends opt-in alerts (11l) to every phone/browser a person turned alerts on for.
// Alert text never includes names, phone numbers or addresses.
export type Alert = { title: string; body: string; url: string; tag?: string };

let ready = false;
function configure() {
  if (ready) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://helloholler.co", pub, priv);
  ready = true;
  return true;
}

export async function sendAlert(db: SupabaseClient, profileIds: string[], alert: Alert) {
  if (!profileIds.length || !configure()) return 0;
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").in("profile_id", profileIds);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(alert), { TTL: 60 * 60 * 12 });
        sent++;
      } catch (e) {
        // The phone unsubscribed or the browser forgot it: tidy up
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    })
  );
  return sent;
}
