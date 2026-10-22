// PostgREST returns PostGIS points as hex EWKB (or GeoJSON). Turn either into { lat, lng }.
export function parsePoint(g: unknown): { lat: number; lng: number } | null {
  if (!g) return null;
  if (typeof g === "object" && Array.isArray((g as { coordinates?: number[] }).coordinates)) {
    const [lng, lat] = (g as { coordinates: number[] }).coordinates;
    return { lat, lng };
  }
  if (typeof g !== "string") return null;
  const buf = Buffer.from(g, "hex");
  if (buf.length < 21) return null;
  const little = buf[0] === 1;
  const type = little ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const off = 5 + (type & 0x20000000 ? 4 : 0);
  const read = (o: number) => (little ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  return { lng: read(off), lat: read(off + 8) };
}

// Distance in meters between two points
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const ONE_MILE_M = 1609;

// "<1 mi", "3 mi" (from fuzzed block locations, so never exact)
export function milesLabel(meters: number) {
  const miles = meters / 1609.34;
  return miles < 1 ? "<1 mi" : `${Math.round(miles)} mi`;
}

// Where a neighbor is from: their neighborhood if Google knows it, else their city
export function hoodLabel(home: { neighborhood?: string | null; city?: string | null } | null | undefined) {
  return home?.neighborhood || home?.city || null;
}
