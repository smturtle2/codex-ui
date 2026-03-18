import { CodexShell } from "@/components/codex-shell";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const demoValue = params.demo;
  const demoMode =
    demoValue === "1" ||
    demoValue === "true" ||
    (Array.isArray(demoValue) && demoValue.includes("1"));

  return <CodexShell demoMode={demoMode} />;
}
