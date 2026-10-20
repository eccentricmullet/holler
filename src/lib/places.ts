import "server-only";
import { SITE } from "@/config/site";

// Google Places API (New). Server only: the key never reaches the browser.
const BASE = "https://places.googleapis.com/v1";

function key() {
  const k = process.env.GOOGLE_PLACES_API_KEY;
  if (!k) throw new Error("GOOGLE_PLACES_API_KEY is not set");
  return k;
}

export type AddressSuggestion = { placeId: string; main: string; secondary: string };

export async function autocompleteAddress(input: string, sessionToken: string): Promise<AddressSuggestion[]> {
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
    body: JSON.stringify({
      input,
      sessionToken,
      includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      includedRegionCodes: ["us"],
      locationBias: {
        circle: {
          center: { latitude: SITE.launchCenter.lat, longitude: SITE.launchCenter.lng },
          radius: 50000,
        },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places autocomplete failed (${res.status})`);
  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text: { text: string };
        structuredFormat?: { mainText: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText.text ?? p.text.text,
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

export type AddressDetails = {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  city: string | null; // shown instead of neighborhood names
};

export async function getAddressDetails(placeId: string, sessionToken?: string): Promise<AddressDetails> {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}${qs}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places details failed (${res.status})`);
  const p = (await res.json()) as {
    id: string;
    formattedAddress: string;
    location: { latitude: number; longitude: number };
    addressComponents?: { longText: string; types: string[] }[];
  };
  const neighborhood = p.addressComponents?.find((c) => c.types.includes("neighborhood"))?.longText ?? null;
  const find = (t: string) => p.addressComponents?.find((c) => c.types.includes(t))?.longText ?? null;
  const city = find("locality") ?? find("postal_town") ?? find("administrative_area_level_3") ?? find("sublocality");
  return {
    placeId: p.id,
    address: p.formattedAddress,
    lat: p.location.latitude,
    lng: p.location.longitude,
    neighborhood,
    city,
  };
}

export type BusinessSuggestion = { placeId: string; name: string; area: string };

// Business name suggestions near the launch town (any kind of place, not addresses).
export async function autocompleteBusiness(input: string, sessionToken: string): Promise<BusinessSuggestion[]> {
  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key() },
    body: JSON.stringify({
      input,
      sessionToken,
      includedPrimaryTypes: ["establishment"],
      includedRegionCodes: ["us"],
      locationBias: {
        circle: {
          center: { latitude: SITE.launchCenter.lat, longitude: SITE.launchCenter.lng },
          radius: 50000,
        },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places business autocomplete failed (${res.status})`);
  const data = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text: { text: string };
        structuredFormat?: { mainText: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => {
      const secondary = p.structuredFormat?.secondaryText?.text ?? "";
      // "123 Main St, Spring Hill, TN, USA" -> "Spring Hill"
      const parts = secondary.split(",").map((s) => s.trim());
      return {
        placeId: p.placeId,
        name: p.structuredFormat?.mainText.text ?? p.text.text,
        area: parts.length >= 3 ? parts[parts.length - 3] : parts[0] ?? "",
      };
    });
}

export type BusinessDetails = {
  placeId: string;
  name: string;
  phone: string | null; // E.164, e.g. +16155550101
  website: string | null;
  types: string[];
};

// Only what the pro page needs. We don't keep Google's location for businesses (see docs/DATA-NOTES.md).
export async function getBusinessDetails(placeId: string, sessionToken?: string): Promise<BusinessDetails> {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}${qs}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": "id,displayName,internationalPhoneNumber,websiteUri,types",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places business details failed (${res.status})`);
  const p = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    internationalPhoneNumber?: string;
    websiteUri?: string;
    types?: string[];
  };
  const digits = p.internationalPhoneNumber?.replace(/[^\d+]/g, "") ?? "";
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed business",
    phone: /^\+\d{8,15}$/.test(digits) ? digits : null,
    website: p.websiteUri ?? null,
    types: p.types ?? [],
  };
}

// Kinds of places that aren't home-service pros. Picking one gets a gentle "are you sure?"
const NOT_A_SERVICE = new Set([
  "restaurant", "cafe", "coffee_shop", "bar", "bakery", "fast_food_restaurant", "meal_takeaway", "meal_delivery", "food",
  "grocery_store", "supermarket", "convenience_store", "clothing_store", "shopping_mall", "department_store", "liquor_store",
  "school", "primary_school", "secondary_school", "university", "church", "place_of_worship", "hospital", "doctor", "dentist",
  "pharmacy", "bank", "atm", "gas_station", "park", "gym", "lodging", "hotel", "movie_theater", "library", "post_office",
  "local_government_office", "city_hall", "courthouse", "police", "fire_station", "tourist_attraction", "museum", "stadium",
  "night_club", "casino", "amusement_park", "zoo", "airport", "train_station", "bus_station",
]);

export type BusinessPreview = {
  placeId: string;
  name: string;
  address: string | null; // shown on the check screen only, never saved
  phone: string | null; // as people write it, e.g. (615) 555-0101
  website: string | null;
  kind: string | null; // Google's label, e.g. "Landscaper"
  notAService: boolean; // looks like a restaurant, store, school…
  types: string[];
};

// What the neighbor sees on "Is this them?" before reacting.
export async function getBusinessPreview(placeId: string, sessionToken?: string): Promise<BusinessPreview> {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}${qs}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,primaryType,primaryTypeDisplayName,types",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places business preview failed (${res.status})`);
  const p = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    primaryType?: string;
    primaryTypeDisplayName?: { text: string };
    types?: string[];
  };
  const types = p.types ?? [];
  const primary = p.primaryType ?? "";
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed business",
    address: p.formattedAddress?.replace(/, USA$/, "") ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    kind: p.primaryTypeDisplayName?.text ?? null,
    notAService: NOT_A_SERVICE.has(primary) || (!primary && types.some((t) => NOT_A_SERVICE.has(t))),
    types,
  };
}
