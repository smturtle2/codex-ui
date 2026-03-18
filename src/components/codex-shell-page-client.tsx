"use client";

import { useSearchParams } from "next/navigation";

import { CodexShell } from "@/components/codex-shell";

export function CodexShellPageClient() {
  const searchParams = useSearchParams();
  const demoValues = searchParams.getAll("demo");
  const demoMode =
    demoValues.includes("1") ||
    demoValues.includes("true");

  return <CodexShell demoMode={demoMode} />;
}
