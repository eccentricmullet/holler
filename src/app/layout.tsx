import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { SITE } from "@/config/site";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
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
