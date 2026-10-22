import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import { getProPage } from "@/lib/pros";
import { initials, logoColor } from "@/components/map/logo";

// The picture in a texted link's preview card: name, category, 👍/❤️ counts.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A pro your neighbors trust";

// Inter from Google Fonts (asks for TTF, which the image renderer needs). Falls back to the default font.
async function rubik(weight: number) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, bold, regular] = await Promise.all([getProPage(id, SITE.launchCenter), rubik(800), rubik(500)]);
  const pro = result.kind === "found" ? result.pro : null;
  const name = pro?.name ?? SITE.name;
  const sub = pro ? [pro.categoryName, SITE.launchTownShort].filter(Boolean).join(" · ") : SITE.tagline;

  const fonts = [
    bold && { name: "Inter", data: bold, weight: 800 as const, style: "normal" as const },
    regular && { name: "Inter", data: regular, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 500; style: "normal" }[];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#F6F7F4", fontFamily: "Inter" }}>
        <div
          style={{
            position: "absolute", left: 60, right: 60, top: 60, bottom: 60, background: "#FFFFFF", borderRadius: 48,
            display: "flex", flexDirection: "column", padding: "56px 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
            {pro?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pro.logoUrl} width={140} height={140} style={{ borderRadius: 140, border: "6px solid #FFFFFF" }} alt="" />
            ) : (
              <div
                style={{
                  width: 140, height: 140, borderRadius: 140, background: logoColor(name, pro?.color), color: "#FFFFFF",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 800,
                }}
              >
                {initials(name)}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ fontSize: 64, fontWeight: 800, color: "#1F2421", lineHeight: 1.05, letterSpacing: "-0.02em" }}>{name}</div>
              <div style={{ fontSize: 34, fontWeight: 500, color: "#5B635E", marginTop: 12 }}>{sub}</div>
            </div>
          </div>
          {pro && (
            <div style={{ display: "flex", gap: 28, marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#E4F9EC", borderRadius: 28, padding: "18px 30px", fontSize: 48, fontWeight: 800, color: "#1A1D24" }}>
                👍 {pro.thumbs}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#FFF0F2", borderRadius: 28, padding: "18px 30px", fontSize: 48, fontWeight: 800, color: "#1A1D24" }}>
                ❤️ {pro.love}
              </div>
              <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", fontSize: 40, fontWeight: 800, color: "#0E6B33" }}>
                {SITE.wordmark}
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined, emoji: "twemoji" }
  );
}
