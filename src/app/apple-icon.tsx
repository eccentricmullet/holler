import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

// The icon iPhones use when someone adds the site to their home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2BB24C" }}>
        <div
          style={{
            width: 112, height: 112, borderRadius: 112, background: "#FFFFFF", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#178A35", fontSize: 76, fontWeight: 800,
          }}
        >
          {SITE.wordmark.charAt(0)}
        </div>
      </div>
    ),
    size
  );
}
