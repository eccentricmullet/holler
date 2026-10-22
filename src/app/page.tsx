import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MapPage from "./map/page";

// The front door: neighbors who are signed in start on the Porch; everyone else sees the public map.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile) redirect("/porch");
  }
  return <MapPage />;
}
