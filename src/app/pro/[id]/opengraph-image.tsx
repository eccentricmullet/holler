import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import { getProPage } from "@/lib/pros";
import { initials, logoColor } from "@/components/map/logo";

// The picture in a texted link's preview card: name, category, 👍/❤️ counts.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A pro your neighbors trust";

// Rubik from Google Fonts (asks for TTF, which the image renderer needs). Falls back to the default font.
async function rubik(weight: number) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Rubik:wght@${weight}`)).text();
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
    bold && { name: "Rubik", data: bold, weight: 800 as const, style: "normal" as const },
    regular && { name: "Rubik", data: regular, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 500; style: "normal" }[];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#2BB24C", fontFamily: "Rubik" }}>
        <div style={{ position: "absolute", left: -120, top: 260, width: 520, height: 520, borderRadius: 520, background: "#7ED957", opacity: 0.55, display: "flex" }} />
        <div style={{ position: "absolute", right: -140, top: -180, width: 520, height: 520, borderRadius: 520, background: "#178A35", opacity: 0.6, display: "flex" }} />
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
              <div style={{ fontSize: 64, fontWeight: 800, color: "#1A1D24", lineHeight: 1.05, letterSpacing: "-0.02em" }}>{name}</div>
              <div style={{ fontSize: 34, fontWeight: 500, color: "#6B7079", marginTop: 12 }}>{sub}</div>
            </div>
          </div>
          {pro && (
            <div style={{ display: "flex", gap: 28, marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#E6F8DC", borderRadius: 28, padding: "18px 30px", fontSize: 48, fontWeight: 800, color: "#1A1D24" }}>
                👍 {pro.thumbs}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#FFF0F2", borderRadius: 28, padding: "18px 30px", fontSize: 48, fontWeight: 800, color: "#1A1D24" }}>
                ❤️ {pro.love}
              </div>
              <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", fontSize: 40, fontWeight: 800, color: "#178A35" }}>
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
