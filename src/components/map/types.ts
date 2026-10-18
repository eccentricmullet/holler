export type Category = { slug: string; name: string; icon: string; section?: string | null };

export type NearbyPro = {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  category_slug: string;
  thumbs_near: number;
  love_near: number;
  customers_near: number;
  thumbs_total: number;
  love_total: number;
};

export type Pin = { pro_id: string; reaction: "thumbs_up" | "love"; pin_lat: number; pin_lng: number };

export type LatLng = { lat: number; lng: number };

// The category the map opens on
export const DEFAULT_CATEGORY = "lawn";
