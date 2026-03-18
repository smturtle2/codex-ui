export type TerminalApplicationTheme = "system" | "dark" | "light";
export type TerminalTabWidthMode = "equal" | "titleLength" | "compact";
export type TerminalCloseButtonVisibility =
  | "always"
  | "hover"
  | "never"
  | "activeOnly";

export type TerminalColorScheme = {
  name: string;
  background?: string;
  foreground?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  purple?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightPurple?: string;
  brightCyan?: string;
  brightWhite?: string;
  cursorColor?: string;
  selectionBackground?: string;
};

export type TerminalTheme = {
  name: string;
  window?: {
    applicationTheme?: TerminalApplicationTheme;
    useMica?: boolean;
  };
  tabRow?: {
    background?: string;
    unfocusedBackground?: string;
  };
  tab?: {
    background?: string;
    unfocusedBackground?: string;
    showCloseButton?: TerminalCloseButtonVisibility;
  };
};

export type TerminalProfileFont = {
  face?: string;
  size?: number;
  weight?: string | number;
};

export type TerminalProfile = {
  guid?: string;
  name: string;
  commandline?: string;
  startingDirectory?: string;
  colorScheme?: string;
  tabTitle?: string;
  tabColor?: string;
  hidden?: boolean;
  font?: TerminalProfileFont;
  opacity?: number;
  useAcrylic?: boolean;
};

export type TerminalSettings = {
  $schema?: string;
  defaultProfile?: string;
  theme?: string;
  alwaysShowTabs?: boolean;
  showTabsInTitlebar?: boolean;
  useAcrylicInTabRow?: boolean;
  tabWidthMode?: TerminalTabWidthMode;
  profiles?: {
    defaults?: Partial<TerminalProfile>;
    list?: TerminalProfile[];
  };
  schemes?: TerminalColorScheme[];
  themes?: TerminalTheme[];
};

export type TerminalSettingsEnvelope = {
  path: string;
  settings: TerminalSettings;
};

export type TerminalUiPalette = {
  fontFace: string;
  terminalBackground: string;
  terminalForeground: string;
  terminalMuted: string;
  terminalBorder: string;
  railBackground: string;
  railForeground: string;
  railBorder: string;
  activeTabBackground: string;
  activeTabForeground: string;
  inactiveTabBackground: string;
  inactiveTabForeground: string;
  windowTheme: TerminalApplicationTheme;
};

export type TerminalAppearanceOption = {
  id: string;
  label: string;
};

export type ParsedWindowsTerminalSettings = {
  settings: TerminalSettings;
  appearance: TerminalUiPalette & {
    profileId: string;
    profileName: string;
    themeName: string;
    availableProfiles: TerminalAppearanceOption[];
    availableThemes: TerminalAppearanceOption[];
    panelBackground: string;
    panelForeground: string;
    lineColor: string;
    softLineColor: string;
    muted: string;
    selection: string;
    tabRowBackground: string;
    tabRowForeground: string;
    tabActiveBackground: string;
    tabActiveForeground: string;
    tabInactiveBackground: string;
    tabInactiveForeground: string;
    background: string;
    foreground: string;
    cursorColor: string;
  };
  error: string | null;
};

const DEFAULT_SCHEMA =
  "https://aka.ms/terminal-profiles-schema";
const DEFAULT_SCHEME_NAME = "WebPTY Black";
const DEFAULT_THEME_NAME = "webpty-flat";
const DEFAULT_PROFILE_GUID = "{8d8d43d2-8d34-4f7a-9f31-c0c611e4a3b2}";

const DEFAULT_SCHEME: TerminalColorScheme = {
  name: DEFAULT_SCHEME_NAME,
  background: "#000000",
  foreground: "#f5f5f5",
  cursorColor: "#f5f5f5",
  selectionBackground: "#333333",
  black: "#0f0f0f",
  red: "#ff6b6b",
  green: "#9cff57",
  yellow: "#f6d365",
  blue: "#7ab6ff",
  purple: "#d18cff",
  cyan: "#6be7ff",
  white: "#e4e4e4",
  brightBlack: "#7d7d7d",
  brightRed: "#ff8f8f",
  brightGreen: "#beff8a",
  brightYellow: "#ffe28a",
  brightBlue: "#a4d0ff",
  brightPurple: "#e3b6ff",
  brightCyan: "#a7f4ff",
  brightWhite: "#ffffff",
};

const DEFAULT_THEME: TerminalTheme = {
  name: DEFAULT_THEME_NAME,
  window: {
    applicationTheme: "light",
    useMica: false,
  },
  tabRow: {
    background: "#ffffff",
    unfocusedBackground: "#f4f4f4",
  },
  tab: {
    background: "#ffffff",
    unfocusedBackground: "#f4f4f4",
    showCloseButton: "hover",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickString(value: unknown, fallback?: string): string | undefined {
  return isString(value) ? value : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeFont(value: unknown, fallback?: TerminalProfileFont): TerminalProfileFont | undefined {
  if (!isRecord(value)) {
    return fallback;
  }

  const font: TerminalProfileFont = {};
  if (isString(value.face)) {
    font.face = value.face;
  }
  const size = pickNumber(value.size);
  if (typeof size !== "undefined") {
    font.size = size;
  }
  if (typeof value.weight === "string" || typeof value.weight === "number") {
    font.weight = value.weight;
  }

  if (Object.keys(font).length === 0) {
    return fallback;
  }

  return font;
}

function normalizeProfile(
  value: unknown,
  fallback: TerminalProfile,
): TerminalProfile {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  return {
    guid: pickString(value.guid, fallback.guid),
    name: pickString(value.name, fallback.name) ?? fallback.name,
    commandline: pickString(value.commandline, fallback.commandline),
    startingDirectory: pickString(value.startingDirectory, fallback.startingDirectory),
    colorScheme: pickString(value.colorScheme, fallback.colorScheme),
    tabTitle: pickString(value.tabTitle, fallback.tabTitle),
    tabColor: pickString(value.tabColor, fallback.tabColor),
    hidden: typeof value.hidden === "boolean" ? value.hidden : fallback.hidden,
    font: normalizeFont(value.font, fallback.font),
    opacity: pickNumber(value.opacity) ?? fallback.opacity,
    useAcrylic:
      typeof value.useAcrylic === "boolean" ? value.useAcrylic : fallback.useAcrylic,
  };
}

function normalizeProfilePatch(
  value: unknown,
  fallback: Partial<TerminalProfile>,
): Partial<TerminalProfile> {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  return {
    guid: pickString(value.guid, fallback.guid),
    name: pickString(value.name, fallback.name),
    commandline: pickString(value.commandline, fallback.commandline),
    startingDirectory: pickString(value.startingDirectory, fallback.startingDirectory),
    colorScheme: pickString(value.colorScheme, fallback.colorScheme),
    tabTitle: pickString(value.tabTitle, fallback.tabTitle),
    tabColor: pickString(value.tabColor, fallback.tabColor),
    hidden:
      typeof value.hidden === "boolean" ? value.hidden : fallback.hidden,
    font: normalizeFont(value.font, fallback.font),
    opacity: pickNumber(value.opacity) ?? fallback.opacity,
    useAcrylic:
      typeof value.useAcrylic === "boolean" ? value.useAcrylic : fallback.useAcrylic,
  };
}

function normalizeScheme(value: unknown): TerminalColorScheme | null {
  if (!isRecord(value) || !isString(value.name)) {
    return null;
  }

  const scheme: TerminalColorScheme = { name: value.name };
  const keys: Array<keyof Omit<TerminalColorScheme, "name">> = [
    "background",
    "foreground",
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "purple",
    "cyan",
    "white",
    "brightBlack",
    "brightRed",
    "brightGreen",
    "brightYellow",
    "brightBlue",
    "brightPurple",
    "brightCyan",
    "brightWhite",
    "cursorColor",
    "selectionBackground",
  ];

  for (const key of keys) {
    if (isString(value[key])) {
      scheme[key] = value[key];
    }
  }

  return scheme;
}

function normalizeTheme(value: unknown): TerminalTheme | null {
  if (!isRecord(value) || !isString(value.name)) {
    return null;
  }

  const theme: TerminalTheme = { name: value.name };
  if (isRecord(value.window)) {
    theme.window = {
      applicationTheme:
        value.window.applicationTheme === "system" ||
        value.window.applicationTheme === "dark" ||
        value.window.applicationTheme === "light"
          ? value.window.applicationTheme
          : undefined,
      useMica:
        typeof value.window.useMica === "boolean" ? value.window.useMica : undefined,
    };
  }
  if (isRecord(value.tabRow)) {
    theme.tabRow = {
      background: pickString(value.tabRow.background),
      unfocusedBackground: pickString(value.tabRow.unfocusedBackground),
    };
  }
  if (isRecord(value.tab)) {
    theme.tab = {
      background: pickString(value.tab.background),
      unfocusedBackground: pickString(value.tab.unfocusedBackground),
      showCloseButton:
        value.tab.showCloseButton === "always" ||
        value.tab.showCloseButton === "hover" ||
        value.tab.showCloseButton === "never" ||
        value.tab.showCloseButton === "activeOnly"
          ? value.tab.showCloseButton
          : undefined,
    };
  }

  return theme;
}

function mergeProfile(
  defaults: Partial<TerminalProfile> | undefined,
  profile: TerminalProfile | undefined,
): TerminalProfile {
  return {
    guid: profile?.guid ?? defaults?.guid,
    name: profile?.name ?? defaults?.name ?? "Default",
    commandline: profile?.commandline ?? defaults?.commandline,
    startingDirectory: profile?.startingDirectory ?? defaults?.startingDirectory,
    colorScheme: profile?.colorScheme ?? defaults?.colorScheme,
    tabTitle: profile?.tabTitle ?? defaults?.tabTitle,
    tabColor: profile?.tabColor ?? defaults?.tabColor,
    hidden: profile?.hidden ?? defaults?.hidden ?? false,
    font: profile?.font ?? defaults?.font,
    opacity: profile?.opacity ?? defaults?.opacity,
    useAcrylic: profile?.useAcrylic ?? defaults?.useAcrylic,
  };
}

export function createDefaultTerminalSettings(
  startingDirectory?: string | null,
): TerminalSettings {
  return {
    $schema: DEFAULT_SCHEMA,
    defaultProfile: DEFAULT_PROFILE_GUID,
    theme: DEFAULT_THEME_NAME,
    alwaysShowTabs: true,
    showTabsInTitlebar: false,
    useAcrylicInTabRow: false,
    tabWidthMode: "compact",
    profiles: {
      defaults: {
        colorScheme: DEFAULT_SCHEME_NAME,
        font: {
          face: "Cascadia Mono",
          size: 12,
          weight: "normal",
        },
        startingDirectory: startingDirectory ?? undefined,
        useAcrylic: false,
        opacity: 100,
      },
      list: [
        {
          guid: DEFAULT_PROFILE_GUID,
          name: "WebPTY",
          commandline: "codex",
          colorScheme: DEFAULT_SCHEME_NAME,
          startingDirectory: startingDirectory ?? undefined,
          tabTitle: "Codex",
          font: {
            face: "Cascadia Mono",
            size: 12,
            weight: "normal",
          },
          tabColor: "#ffffff",
          useAcrylic: false,
          opacity: 100,
        },
      ],
    },
    schemes: [{ ...DEFAULT_SCHEME }],
    themes: [{ ...DEFAULT_THEME }],
  };
}

export function normalizeTerminalSettings(
  value: unknown,
  startingDirectory?: string | null,
): TerminalSettings {
  const fallback = createDefaultTerminalSettings(startingDirectory);

  if (!isRecord(value)) {
    return fallback;
  }

  const defaults = normalizeProfilePatch(
    value.profiles && isRecord(value.profiles) ? value.profiles.defaults : undefined,
    fallback.profiles?.defaults ?? {},
  );
  const fallbackProfile = mergeProfile(defaults, fallback.profiles?.list?.[0]);
  const listSource =
    value.profiles && isRecord(value.profiles) && Array.isArray(value.profiles.list)
      ? value.profiles.list
      : fallback.profiles?.list ?? [];
  const list = listSource
    .map((entry) => normalizeProfile(entry, fallbackProfile))
    .filter((profile) => profile.name.trim().length > 0);

  const schemesSource = Array.isArray(value.schemes) ? value.schemes : fallback.schemes ?? [];
  const schemes = schemesSource
    .map(normalizeScheme)
    .filter((entry): entry is TerminalColorScheme => Boolean(entry));

  if (!schemes.some((scheme) => scheme.name === DEFAULT_SCHEME_NAME)) {
    schemes.push({ ...DEFAULT_SCHEME });
  }

  const themesSource = Array.isArray(value.themes) ? value.themes : fallback.themes ?? [];
  const themes = themesSource
    .map(normalizeTheme)
    .filter((entry): entry is TerminalTheme => Boolean(entry));

  if (!themes.some((theme) => theme.name === DEFAULT_THEME_NAME)) {
    themes.push({ ...DEFAULT_THEME });
  }

  const theme =
    isString(value.theme) && themes.some((entry) => entry.name === value.theme)
      ? value.theme
      : fallback.theme;

  const defaultProfile =
    isString(value.defaultProfile) &&
    list.some((profile) => profile.guid === value.defaultProfile || profile.name === value.defaultProfile)
      ? value.defaultProfile
      : fallback.defaultProfile;

  const tabWidthMode =
    value.tabWidthMode === "equal" ||
    value.tabWidthMode === "titleLength" ||
    value.tabWidthMode === "compact"
      ? value.tabWidthMode
      : fallback.tabWidthMode;

  return {
    $schema: pickString(value.$schema, fallback.$schema),
    defaultProfile,
    theme,
    alwaysShowTabs: pickBoolean(value.alwaysShowTabs, fallback.alwaysShowTabs ?? true),
    showTabsInTitlebar: pickBoolean(
      value.showTabsInTitlebar,
      fallback.showTabsInTitlebar ?? false,
    ),
    useAcrylicInTabRow: pickBoolean(
      value.useAcrylicInTabRow,
      fallback.useAcrylicInTabRow ?? false,
    ),
    tabWidthMode,
    profiles: {
      defaults,
      list: list.length > 0 ? list : fallback.profiles?.list ?? [],
    },
    schemes,
    themes,
  };
}

export function resolveTerminalProfile(settings: TerminalSettings): TerminalProfile {
  const defaults = settings.profiles?.defaults;
  const list = settings.profiles?.list ?? [];
  const active =
    list.find(
      (profile) =>
        !profile.hidden &&
        (profile.guid === settings.defaultProfile || profile.name === settings.defaultProfile),
    ) ??
    list.find((profile) => !profile.hidden) ??
    list[0];

  return mergeProfile(defaults, active);
}

export function resolveTerminalScheme(settings: TerminalSettings): TerminalColorScheme {
  const profile = resolveTerminalProfile(settings);
  const schemeName = profile.colorScheme ?? settings.profiles?.defaults?.colorScheme;
  const scheme =
    settings.schemes?.find((entry) => entry.name === schemeName) ??
    settings.schemes?.[0] ??
    DEFAULT_SCHEME;

  return {
    ...DEFAULT_SCHEME,
    ...scheme,
  };
}

export function resolveTerminalTheme(settings: TerminalSettings): TerminalTheme {
  const themeName = settings.theme ?? DEFAULT_THEME_NAME;
  const theme =
    settings.themes?.find((entry) => entry.name === themeName) ??
    settings.themes?.[0] ??
    DEFAULT_THEME;

  return {
    ...DEFAULT_THEME,
    ...theme,
    window: {
      ...DEFAULT_THEME.window,
      ...theme.window,
    },
    tabRow: {
      ...DEFAULT_THEME.tabRow,
      ...theme.tabRow,
    },
    tab: {
      ...DEFAULT_THEME.tab,
      ...theme.tab,
    },
  };
}

export function getTerminalStartingDirectory(
  settings: TerminalSettings,
): string | null {
  const profile = resolveTerminalProfile(settings);
  return (
    profile.startingDirectory ??
    settings.profiles?.defaults?.startingDirectory ??
    null
  );
}

export function buildTerminalUiPalette(
  settings: TerminalSettings,
): TerminalUiPalette {
  const profile = resolveTerminalProfile(settings);
  const scheme = resolveTerminalScheme(settings);
  const theme = resolveTerminalTheme(settings);

  const terminalBackground = scheme.background ?? DEFAULT_SCHEME.background ?? "#000000";
  const terminalForeground = scheme.foreground ?? DEFAULT_SCHEME.foreground ?? "#f5f5f5";

  return {
    fontFace: profile.font?.face ?? settings.profiles?.defaults?.font?.face ?? "Cascadia Mono",
    terminalBackground,
    terminalForeground,
    terminalMuted: scheme.brightBlack ?? "#8c8c8c",
    terminalBorder: scheme.brightBlack ?? "#2a2a2a",
    railBackground: theme.tabRow?.background ?? "#ffffff",
    railForeground: "#111111",
    railBorder: "#cfcfcf",
    activeTabBackground: theme.tab?.background ?? "#ffffff",
    activeTabForeground: "#111111",
    inactiveTabBackground: theme.tab?.unfocusedBackground ?? "#f4f4f4",
    inactiveTabForeground: "#555555",
    windowTheme: theme.window?.applicationTheme ?? "light",
  };
}

export function serializeTerminalSettings(settings: TerminalSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

function getProfileId(profile: TerminalProfile): string {
  return profile.guid ?? profile.name;
}

function getProfileLabel(profile: TerminalProfile): string {
  return profile.tabTitle ?? profile.name;
}

function getThemeOptions(settings: TerminalSettings): TerminalAppearanceOption[] {
  const names = new Set<string>(["system", "light", "dark"]);

  for (const theme of settings.themes ?? []) {
    names.add(theme.name);
  }

  return [...names].map((name) => ({
    id: name,
    label: name,
  }));
}

export function getDefaultWindowsTerminalSettingsText(
  startingDirectory?: string | null,
): string {
  return serializeTerminalSettings(createDefaultTerminalSettings(startingDirectory));
}

export function stringifyWindowsTerminalSettings(settings: TerminalSettings): string {
  return serializeTerminalSettings(normalizeTerminalSettings(settings));
}

export function updateDefaultProfile(
  settings: TerminalSettings,
  profileId: string,
): TerminalSettings {
  const normalized = normalizeTerminalSettings(settings);
  const nextDefault =
    normalized.profiles?.list?.find(
      (profile) => getProfileId(profile) === profileId || profile.name === profileId,
    ) ?? normalized.profiles?.list?.[0];

  return {
    ...normalized,
    defaultProfile: nextDefault ? getProfileId(nextDefault) : normalized.defaultProfile,
  };
}

export function updateThemeName(
  settings: TerminalSettings,
  themeName: string,
): TerminalSettings {
  const normalized = normalizeTerminalSettings(settings);
  return {
    ...normalized,
    theme: themeName,
  };
}

function buildParsedAppearance(settings: TerminalSettings): ParsedWindowsTerminalSettings["appearance"] {
  const profile = resolveTerminalProfile(settings);
  const scheme = resolveTerminalScheme(settings);
  const palette = buildTerminalUiPalette(settings);
  const availableProfiles = (settings.profiles?.list ?? [])
    .filter((entry) => !entry.hidden)
    .map((entry) => ({
      id: getProfileId(entry),
      label: getProfileLabel(entry),
    }));

  const tabRowBackground = palette.railBackground;
  const tabRowForeground = palette.railForeground;
  const tabActiveBackground = profile.tabColor ?? palette.activeTabBackground;

  return {
    ...palette,
    profileId: getProfileId(profile),
    profileName: getProfileLabel(profile),
    themeName: settings.theme ?? DEFAULT_THEME_NAME,
    availableProfiles:
      availableProfiles.length > 0
        ? availableProfiles
        : [{ id: DEFAULT_PROFILE_GUID, label: "WebPTY" }],
    availableThemes: getThemeOptions(settings),
    panelBackground: palette.railBackground,
    panelForeground: palette.railForeground,
    lineColor: palette.terminalBorder,
    softLineColor: scheme.black ?? "#1a1a1a",
    muted: palette.terminalMuted,
    selection: scheme.selectionBackground ?? "#333333",
    tabRowBackground,
    tabRowForeground,
    tabActiveBackground,
    tabActiveForeground: palette.activeTabForeground,
    tabInactiveBackground: palette.inactiveTabBackground,
    tabInactiveForeground: palette.inactiveTabForeground,
    background: palette.terminalBackground,
    foreground: palette.terminalForeground,
    cursorColor: scheme.cursorColor ?? palette.terminalForeground,
  };
}

export function parseWindowsTerminalSettingsText(
  text: string,
): ParsedWindowsTerminalSettings {
  try {
    const parsed = JSON.parse(text) as unknown;
    const settings = normalizeTerminalSettings(parsed);
    return {
      settings,
      appearance: buildParsedAppearance(settings),
      error: null,
    };
  } catch (error) {
    const settings = createDefaultTerminalSettings();
    return {
      settings,
      appearance: buildParsedAppearance(settings),
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}
