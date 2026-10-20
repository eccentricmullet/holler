import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import MapScreen from "@/components/map/MapScreen";
import { DEFAULT_CATEGORY, type NearbyPro, type Pin } from "@/components/map/types";
import { metersBetween } from "@/lib/geo";
import { createAdminClient } from "@/lib/supabase/admin";

// Most-reacted category overall (falls back to Lawn before anyone has reacted)
async function busiestCategory() {
  const { data } = await createAdminClient().from("vouches").select("categories(slug)").eq("status", "visible").limit(5000);
  const tally = new Map<string, number>();
  for (const v of data ?? []) {
    const slug = (v.categories as unknown as { slug: string } | null)?.slug;
    if (slug) tally.set(slug, (tally.get(slug) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? DEFAULT_CATEGORY;
}

export default async function Home() {
  const supabase = await createClient();
  const [{ data: categories }, { data: userData }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
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
      city: string | null;
    }>();
    if (data?.home_lat != null && data.home_lng != null) {
      home = { point: { lat: data.home_lat, lng: data.home_lng }, initial: data.first_name.charAt(0).toUpperCase() };
      if (data.city) placeName = data.city;
    }
  }

  const center = home?.point ?? SITE.launchCenter;
  const farFromLaunch = !!home && metersBetween(home.point, SITE.launchCenter) > SITE.launchRadiusM;

  // Load the first category here so pro cards appear with the page instead of after it
  // Open on the category neighbors have reacted to most, so the first screen shows pros
  const startCategory = await busiestCategory();
  const args = { lat: center.lat, lng: center.lng, category: startCategory };
  const [prosRes, pinsRes] = await Promise.all([supabase.rpc("pros_near", args), supabase.rpc("map_pins", args)]);
  const ok = !prosRes.error && !pinsRes.error;

  // Each pro's own pin color, so the first map draw already has them (11j)
  const initialColors: Record<string, string> = {};
  const ids = ok ? (prosRes.data as NearbyPro[]).map((p) => p.id) : [];
  if (ids.length) {
    const { data } = await supabase.from("pros").select("id, color").in("id", ids);
    for (const p of (data ?? []) as { id: string; color: string | null }[]) if (p.color) initialColors[p.id] = p.color;
  }

  return (
    <MapScreen
      farFromLaunch={farFromLaunch}
      categories={categories ?? []}
      center={center}
      home={home}
      placeName={placeName}
      signedIn={!!userData.user}
      initialPros={ok ? (prosRes.data as NearbyPro[]) : null}
      initialPins={ok ? (pinsRes.data as Pin[]) : []}
      initialColors={initialColors}
      initialCategory={startCategory}
    />
  );
}
