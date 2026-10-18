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
  return {
    placeId: p.id,
    address: p.formattedAddress,
    lat: p.location.latitude,
    lng: p.location.longitude,
    neighborhood,
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
  lat: number | null;
  lng: number | null;
  town: string | null;
  types: string[];
};

export async function getBusinessDetails(placeId: string, sessionToken?: string): Promise<BusinessDetails> {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}${qs}`, {
    headers: {
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": "id,displayName,internationalPhoneNumber,websiteUri,location,addressComponents,types",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Places business details failed (${res.status})`);
  const p = (await res.json()) as {
    id: string;
    displayName?: { text: string };
    internationalPhoneNumber?: string;
    websiteUri?: string;
    location?: { latitude: number; longitude: number };
    addressComponents?: { longText: string; types: string[] }[];
    types?: string[];
  };
  const digits = p.internationalPhoneNumber?.replace(/[^\d+]/g, "") ?? "";
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed business",
    phone: /^\+\d{8,15}$/.test(digits) ? digits : null,
    website: p.websiteUri ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    town: p.addressComponents?.find((c) => c.types.includes("locality"))?.longText ?? null,
    types: p.types ?? [],
  };
}
