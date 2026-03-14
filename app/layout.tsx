import type { ReactNode } from "react";
import { IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata = {
  title: "Codex WebUI",
  description: "Terminal-faithful local WebUI for Codex app-server.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
