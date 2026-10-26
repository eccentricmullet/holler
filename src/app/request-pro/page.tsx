import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import RequestProForm from "./RequestProForm";

export const metadata: Metadata = { title: `Ask us to add a pro · ${SITE.name}` };

export default async function RequestProPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name = "" } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent("/request-pro")}`);
  const { data: cats } = await supabase.from("categories").select("slug, name, icon").order("sort_order");
  return <RequestProForm categories={cats ?? []} initialName={name.slice(0, 80)} />;
}
