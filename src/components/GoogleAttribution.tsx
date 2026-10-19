import { Roboto } from "next/font/google";

// Google requires this credit wherever its search results show outside a Google map:
// the words "Google Maps", Roboto 400, #5E5E5E, 12–16px, not translated, near the results.
// https://developers.google.com/maps/documentation/places/web-service/policies
const roboto = Roboto({ weight: "400", subsets: ["latin"], display: "swap" });

export default function GoogleAttribution({ className = "" }: { className?: string }) {
  return (
    <span
      translate="no"
      aria-label="Google Maps"
      className={`${roboto.className} block whitespace-nowrap text-[12px] leading-none ${className}`}
      style={{ color: "#5E5E5E" }}
    >
      Google Maps
    </span>
  );
}
