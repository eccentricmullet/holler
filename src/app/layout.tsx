import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SITE } from "@/config/site";
import { preconnect } from "react-dom";
import Analytics from "@/components/Analytics";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import TabBar from "@/components/TabBar";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Full links in previews need the site's address. Vercel provides it; locally it's localhost.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${SITE.name} · ${SITE.tagline}`,
  description: SITE.tagline,
  // Opens full screen (no Safari bar) when added to an iPhone home screen
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f4",
  width: "device-width",
  initialScale: 1,
  // Lets the tab bar know how tall the iPhone home bar is, so it sits above it
  viewportFit: "cover",
};

// `panel` shows a pro page beside the map when opened from inside the app.
export default function RootLayout({ children, panel }: Readonly<{ children: React.ReactNode; panel: React.ReactNode }>) {
  // Start talking to the map servers while the page is still loading
  preconnect("https://api.mapbox.com");
  preconnect("https://events.mapbox.com");
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">
        {children}
        {panel}
        <TabBar />
        <Analytics />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
