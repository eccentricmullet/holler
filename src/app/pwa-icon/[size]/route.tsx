import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

// Home-screen and alert icon: the wordmark's first letter on Holler green.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Math.min(512, Math.max(48, Number((await params).size) || 192));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#35E07B" }}>
        <div
          style={{
            width: n * 0.62, height: n * 0.62, borderRadius: n, background: "#FFFFFF", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#10241A", fontSize: n * 0.42, fontWeight: 800,
          }}
        >
          {SITE.wordmark.charAt(0)}
        </div>
      </div>
    ),
    { width: n, height: n, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
