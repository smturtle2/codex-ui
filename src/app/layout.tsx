import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Codex WebUI",
  description: "ChatGPT-like local WebUI for codex app-server v2.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
