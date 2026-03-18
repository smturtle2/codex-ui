import type { ReactNode } from "react";
import type { Viewport } from "next";

import "./globals.css";

export const metadata = {
  title: "WebPty",
  description:
    "Windows Terminal-inspired Codex shell with a Rust runtime and Windows Terminal-compatible settings JSON.",
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
