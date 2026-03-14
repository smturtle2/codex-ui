export type ComposerAttachment =
  | { id: string; type: "localImage"; label: string; path: string }
  | { id: string; type: "skill"; label: string; name: string; path: string }
  | { id: string; type: "mention"; label: string; name: string; path: string };

export type UtilityView = "pending" | "diff" | "review" | "logs" | "settings";
