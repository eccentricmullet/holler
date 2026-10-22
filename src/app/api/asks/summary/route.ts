import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { asksNear, myAsks } from "@/lib/asks";

// For the little map chip: how many neighbors near you are asking, and answers on your own open asks.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ near: 0, answers: 0 });
  const db = createAdminClient();
  const [near, mine] = await Promise.all([asksNear(db, user.id), myAsks(db, user.id)]);
  return NextResponse.json(
    {
      near: near.filter((a) => !a.mine && a.open && !a.answeredByMe).length,
      answers: mine.filter((a) => a.open).reduce((n, a) => n + a.suggestions.reduce((m, s) => m + s.count, 0), 0),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
