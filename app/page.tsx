import { Suspense } from "react";

import { CodexShellPageClient } from "@/components/codex-shell-page-client";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CodexShellPageClient />
    </Suspense>
  );
}
