import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import NewAsk from "./NewAsk";

export const metadata: Metadata = { title: `Ask your neighbors · ${SITE.name}` };

export default async function NewAskPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/asks/new?category=${category ?? ""}`)}`);
  const { data: cat } = await supabase.from("categories").select("slug, name, icon").eq("slug", category ?? "").maybeSingle();
  if (!cat) notFound();
  return <NewAsk category={cat} />;
}
