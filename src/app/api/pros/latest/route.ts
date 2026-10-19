import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For map cards and pins: when each pro was last reacted to ("this fall") and each pro's own color.
// Public info only.
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "").split(",").filter((id) => UUID.test(id)).slice(0, 50);
  if (!ids.length) return NextResponse.json({ latest: {}, colors: {} });

  const db = createAdminClient();
  const [{ data: vouches }, { data: pros }] = await Promise.all([
    db.from("vouches").select("pro_id, created_at").in("pro_id", ids).eq("status", "visible").order("created_at", { ascending: false }).limit(2000),
    db.from("pros").select("id, color").in("id", ids),
  ]);

  const latest: Record<string, string> = {};
  for (const v of vouches ?? []) if (!latest[v.pro_id]) latest[v.pro_id] = v.created_at;
  const colors: Record<string, string> = {};
  for (const p of pros ?? []) if (p.color) colors[p.id] = p.color;
  return NextResponse.json({ latest, colors }, { headers: { "Cache-Control": "public, max-age=60" } });
}
