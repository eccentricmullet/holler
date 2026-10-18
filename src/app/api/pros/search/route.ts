import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autocompleteBusiness } from "@/lib/places";

export type SearchResult =
  | { kind: "holler"; proId: string; name: string; thumbs: number; love: number; logoUrl: string | null }
  | { kind: "google"; placeId: string; name: string; area: string };

// Find a business to react to: pros already on Holler first, then new ones from Google.
// Signed-in users only, so strangers can't run up the Google bill.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? "";
  if (q.length < 2 || q.length > 100) return NextResponse.json({ results: [] });

  const db = createAdminClient();
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const [{ data: pros }, google] = await Promise.all([
    db
      .from("pros")
      .select("id, name, logo_url, google_place_id, vouches(reaction, status)")
      .eq("status", "active")
      .is("merged_into_id", null)
      .ilike("name", pattern)
      .limit(5),
    autocompleteBusiness(q, session).catch((e) => {
      console.error(e instanceof Error ? e.message : "Places business error");
      return [];
    }),
  ]);

  const holler: SearchResult[] = (pros ?? []).map((p) => {
    const visible = ((p.vouches ?? []) as { reaction: string; status: string }[]).filter((v) => v.status === "visible");
    return {
      kind: "holler",
      proId: p.id,
      name: p.name,
      logoUrl: p.logo_url,
      thumbs: visible.filter((v) => v.reaction === "thumbs_up").length,
      love: visible.filter((v) => v.reaction === "love").length,
    };
  });

  // Google results that are already on Holler show as the Holler pro instead
  const known = new Set((pros ?? []).map((p) => p.google_place_id).filter(Boolean));
  const googleIds = google.map((g) => g.placeId).filter((id) => !known.has(id));
  const { data: matched } = googleIds.length
    ? await db
        .from("pros")
        .select("id, name, logo_url, google_place_id, vouches(reaction, status)")
        .in("google_place_id", googleIds)
        .eq("status", "active")
    : { data: [] };
  for (const p of matched ?? []) {
    known.add(p.google_place_id);
    const visible = ((p.vouches ?? []) as { reaction: string; status: string }[]).filter((v) => v.status === "visible");
    holler.push({
      kind: "holler",
      proId: p.id,
      name: p.name,
      logoUrl: p.logo_url,
      thumbs: visible.filter((v) => v.reaction === "thumbs_up").length,
      love: visible.filter((v) => v.reaction === "love").length,
    });
  }

  const fresh: SearchResult[] = google
    .filter((g) => !known.has(g.placeId))
    .map((g) => ({ kind: "google", placeId: g.placeId, name: g.name, area: g.area }));

  return NextResponse.json({ results: [...holler, ...fresh].slice(0, 8) });
}
