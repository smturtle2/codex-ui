import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Codex UI",
  description: "Monochrome local WebUI for Codex with live WebSocket streaming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
