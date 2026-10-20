import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { porchSummary } from "@/lib/porch";

// For the map's Porch button: new posts near you since your last visit, and a peek at the newest.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0, peek: null });
  const since = request.nextUrl.searchParams.get("since");
  const sinceIso = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : new Date(Date.now() - 3 * 864e5).toISOString();
  const summary = await porchSummary(createAdminClient(), user.id, sinceIso);
  return NextResponse.json(summary, { headers: { "Cache-Control": "private, no-store" } });
}
