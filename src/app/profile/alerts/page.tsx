import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import AlertSettings from "./AlertSettings";
import ReachPicker from "@/app/porch/ReachPicker";
import { DEFAULT_REACH } from "@/lib/reach";

export const metadata: Metadata = { title: `Alerts · ${SITE.name}` };

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/profile/alerts");
  const { data: p } = await supabase.from("profiles").select("alert_asks, alert_answers, alert_porch_daily, reach_miles").eq("id", user.id).maybeSingle();
  if (!p) redirect("/signup?next=/profile/alerts");
  return (
    <AlertSettings
      initial={{ asks: p.alert_asks, answers: p.alert_answers, porchDaily: p.alert_porch_daily }}
      publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
    >
      <section className="mt-8">
        <h2 className="text-[17px] font-bold">How close for instant alerts?</h2>
        <p className="mt-1 text-sm text-muted">New requests from neighbors this close buzz your phone. The Porch itself always shows 20 miles.</p>
        <ReachPicker miles={p.reach_miles ?? DEFAULT_REACH} />
      </section>
    </AlertSettings>
  );
}
