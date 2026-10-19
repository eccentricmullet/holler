import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyPorchAlerts } from "@/lib/alerts";
import { sendAlert } from "@/lib/push";

// Runs once each evening (vercel.json). Vercel signs the call with CRON_SECRET; anyone else is turned away.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const db = createAdminClient();
  const alerts = await dailyPorchAlerts(db);
  let sent = 0;
  for (const a of alerts) sent += await sendAlert(db, [a.id], a.alert);
  return NextResponse.json({ people: alerts.length, sent });
}
