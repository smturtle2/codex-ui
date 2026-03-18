import type { ReactNode } from "react";
import type { Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";

import "./globals.css";

const sans = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-app-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-app-mono",
});

export const metadata = {
  title: "Codex UI",
  description:
    "Transcript-first monochrome local WebUI for Codex with live WebSocket streaming.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
