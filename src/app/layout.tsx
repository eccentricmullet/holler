import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { SITE } from "@/config/site";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
});

// Full links in previews need the site's address. Vercel provides it; locally it's localhost.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${SITE.name} · ${SITE.tagline}`,
  description: SITE.tagline,
};

export const viewport: Viewport = {
  themeColor: "#2bb24c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={rubik.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
