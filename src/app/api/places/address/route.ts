import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { autocompleteAddress } from "@/lib/places";

// Address suggestions while typing. Signed-in users only, so strangers can't run up the Google bill.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const session = request.nextUrl.searchParams.get("session") ?? "";
  if (q.length < 3 || q.length > 200) return NextResponse.json({ suggestions: [] });

  try {
    const suggestions = await autocompleteAddress(q, session);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error(e instanceof Error ? e.message : "Places autocomplete error");
    return NextResponse.json({ error: "Address search isn't working right now." }, { status: 502 });
  }
}
