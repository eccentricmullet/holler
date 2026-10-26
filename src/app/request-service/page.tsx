import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import RequestServiceForm from "./RequestServiceForm";

export const metadata: Metadata = { title: `Suggest a service · ${SITE.name}` };

export default async function RequestServicePage({ searchParams }: { searchParams: Promise<{ name?: string; back?: string }> }) {
  const { name = "", back } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent("/request-service")}`);
  // Only go back to pages inside the app
  const backHref = back?.startsWith("/") && !back.startsWith("//") ? back : "/porch";
  return <RequestServiceForm initialName={name.slice(0, 40)} backHref={backHref} />;
}
