import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import NewAsk from "./NewAsk";

export const metadata: Metadata = { title: `Ask for a pro · ${SITE.name}` };

export default async function NewAskPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/asks/new${category ? `?category=${category}` : ""}`)}`);
  const { data: cats } = await supabase.from("categories").select("slug, name, icon").order("sort_order");
  const preset = cats?.some((c) => c.slug === category) ? category! : null;
  return <NewAsk categories={cats ?? []} preset={preset} />;
}
