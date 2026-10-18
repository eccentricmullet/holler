import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import DetailsForm from "./DetailsForm";

export const metadata: Metadata = { title: `Privacy and details · ${SITE.name}` };

export default async function DetailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup?next=/profile/details");
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_initial, privacy")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/signup?next=/profile/details");

  return (
    <DetailsForm
      initial={{
        firstName: profile.first_name,
        lastInitial: profile.last_initial,
        privacy: profile.privacy as "block" | "hidden",
      }}
    />
  );
}
