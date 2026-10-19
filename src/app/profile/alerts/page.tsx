import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import AlertSettings from "./AlertSettings";

export const metadata: Metadata = { title: `Alerts · ${SITE.name}` };

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/profile/alerts");
  const { data: p } = await supabase.from("profiles").select("alert_asks, alert_answers, alert_porch_daily").eq("id", user.id).maybeSingle();
  if (!p) redirect("/signup?next=/profile/alerts");
  return (
    <AlertSettings
      initial={{ asks: p.alert_asks, answers: p.alert_answers, porchDaily: p.alert_porch_daily }}
      publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    />
  );
}
