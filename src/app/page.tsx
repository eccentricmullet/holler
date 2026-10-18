import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import MapScreen from "@/components/map/MapScreen";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: categories }, { data: userData }] = await Promise.all([
    supabase.from("categories").select("slug, name, icon").order("sort_order"),
    supabase.auth.getUser(),
  ]);

  // Signed in: center on their (fuzzed) block. Otherwise: the launch town.
  let home: { point: { lat: number; lng: number }; initial: string } | null = null;
  let placeName: string = SITE.launchTownShort;
  if (userData.user) {
    const { data } = await supabase.rpc("my_home").maybeSingle<{
      first_name: string;
      home_lat: number | null;
      home_lng: number | null;
      neighborhood: string | null;
    }>();
    if (data?.home_lat != null && data.home_lng != null) {
      home = { point: { lat: data.home_lat, lng: data.home_lng }, initial: data.first_name.charAt(0).toUpperCase() };
      if (data.neighborhood) placeName = data.neighborhood;
    }
  }

  return (
    <MapScreen
      categories={categories ?? []}
      center={home?.point ?? SITE.launchCenter}
      home={home}
      placeName={placeName}
      signedIn={!!userData.user}
    />
  );
}
