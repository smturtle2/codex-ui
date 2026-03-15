import type { ReactNode } from "react";
import type { Viewport } from "next";

import "./globals.css";

export const metadata = {
  title: "Codex UI",
  description: "Monochrome local WebUI for Codex with live WebSocket streaming.",
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
      <body>{children}</body>
    </html>
  );
}
