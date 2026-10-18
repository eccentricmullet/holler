import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestCategory } from "./actions";
import ReactFlow from "./ReactFlow";

export const metadata: Metadata = { title: `React to a pro · ${SITE.name}` };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReactPage({ searchParams }: { searchParams: Promise<{ pro?: string }> }) {
  const { pro: proParam } = await searchParams;
  const here = proParam ? `/react?pro=${encodeURIComponent(proParam)}` : "/react";

  // Reacting needs a finished, phone-verified account
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(here)}`);
  const { data: profile } = await supabase.from("profiles").select("id, household_id").eq("id", user.id).maybeSingle();
  if (!profile?.household_id) redirect(`/signup?next=${encodeURIComponent(here)}`);

  const { data: categories } = await supabase.from("categories").select("slug, name, icon").order("sort_order");

  // Came from a pro page: skip the search
  let start: { proId: string; name: string; logoUrl: string | null; category: string | null } | null = null;
  if (proParam && UUID.test(proParam)) {
    const { data: pro } = await createAdminClient()
      .from("pros")
      .select("id, name, logo_url, status")
      .eq("id", proParam)
      .maybeSingle();
    if (pro && pro.status === "active") {
      const category = await suggestCategory({ kind: "holler", proId: pro.id }, pro.name);
      start = { proId: pro.id, name: pro.name, logoUrl: pro.logo_url, category };
    }
  }

  return <ReactFlow categories={categories ?? []} start={start} />;
}
