import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// When each pro was most recently reacted to (for "Latest: this fall" on map cards). Public info only.
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => UUID.test(id)).slice(0, 50);
  if (!ids.length) return NextResponse.json({ latest: {} });

  const { data } = await createAdminClient()
    .from("vouches")
    .select("pro_id, created_at")
    .in("pro_id", ids)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(2000);

  const latest: Record<string, string> = {};
  for (const v of data ?? []) if (!latest[v.pro_id]) latest[v.pro_id] = v.created_at;
  return NextResponse.json({ latest }, { headers: { "Cache-Control": "public, max-age=60" } });
}
