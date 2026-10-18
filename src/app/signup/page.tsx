import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import SignupFlow from "./SignupFlow";

export const metadata: Metadata = { title: `Sign up · ${SITE.name}` };

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile) redirect("/");
  }

  // Phone already verified but sign-up not finished: pick up at the name step.
  return <SignupFlow startAt={user ? "name" : "phone"} />;
}
