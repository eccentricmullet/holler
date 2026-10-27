import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import NewCurbItem from "./NewCurbItem";

export const metadata: Metadata = { title: `List on the Curb · ${SITE.name}` };

export default async function NewCurbItemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/curb/new");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/signup?next=/curb/new");
  return <NewCurbItem />;
}
