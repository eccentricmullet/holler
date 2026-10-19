import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { newPostCount } from "@/lib/porch";

// For the badge on the map's Porch button: new posts near you since your last visit.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });
  const since = request.nextUrl.searchParams.get("since");
  const sinceIso = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : new Date(Date.now() - 3 * 864e5).toISOString();
  const count = await newPostCount(createAdminClient(), user.id, sinceIso);
  return NextResponse.json({ count }, { headers: { "Cache-Control": "private, no-store" } });
}
