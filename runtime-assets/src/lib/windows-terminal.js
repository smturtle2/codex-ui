"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultTerminalSettings = createDefaultTerminalSettings;
exports.normalizeTerminalSettings = normalizeTerminalSettings;
exports.resolveTerminalProfile = resolveTerminalProfile;
exports.resolveTerminalScheme = resolveTerminalScheme;
exports.resolveTerminalTheme = resolveTerminalTheme;
exports.getTerminalStartingDirectory = getTerminalStartingDirectory;
exports.buildTerminalUiPalette = buildTerminalUiPalette;
exports.serializeTerminalSettings = serializeTerminalSettings;
exports.getDefaultWindowsTerminalSettingsText = getDefaultWindowsTerminalSettingsText;
exports.stringifyWindowsTerminalSettings = stringifyWindowsTerminalSettings;
exports.updateDefaultProfile = updateDefaultProfile;
exports.updateThemeName = updateThemeName;
exports.parseWindowsTerminalSettingsText = parseWindowsTerminalSettingsText;
const DEFAULT_SCHEMA = "https://aka.ms/terminal-profiles-schema";
const DEFAULT_SCHEME_NAME = "WebPTY Black";
const DEFAULT_THEME_NAME = "webpty-flat";
const DEFAULT_PROFILE_GUID = "{8d8d43d2-8d34-4f7a-9f31-c0c611e4a3b2}";
const BUILTIN_THEME_NAMES = new Set(["system", "light", "dark"]);
const AUTO_THEME_PREFIX = "__auto__:";
const DEFAULT_SCHEME = {
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
const DEFAULT_THEME = {
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
const BUILTIN_THEMES = {
    system: {
        name: "system",
        window: {
            applicationTheme: "system",
            useMica: false,
        },
        tabRow: {
            background: "#ffffff",
            unfocusedBackground: "#f3f3f3",
        },
        tab: {
            background: "#ffffff",
            unfocusedBackground: "#f3f3f3",
            showCloseButton: "hover",
        },
    },
    light: {
        name: "light",
        window: {
            applicationTheme: "light",
            useMica: false,
        },
        tabRow: {
            background: "#ffffff",
            unfocusedBackground: "#f3f3f3",
        },
        tab: {
            background: "#ffffff",
            unfocusedBackground: "#f3f3f3",
            showCloseButton: "hover",
        },
    },
    dark: {
        name: "dark",
        window: {
            applicationTheme: "dark",
            useMica: false,
        },
        tabRow: {
            background: "#111111",
            unfocusedBackground: "#0b0b0b",
        },
        tab: {
            background: "#171717",
            unfocusedBackground: "#101010",
            showCloseButton: "hover",
        },
    },
};
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function pickString(value, fallback) {
    return isString(value) ? value : fallback;
}
function pickBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
function pickNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function normalizeAppearanceReference(value, fallback) {
    if (isString(value)) {
        return value;
    }
    if (!isRecord(value)) {
        return fallback
            ? typeof fallback === "string"
                ? fallback
                : { ...fallback }
            : fallback;
    }
    const reference = {
        ...value,
        light: pickString(value.light),
        dark: pickString(value.dark),
    };
    if (!reference.light) {
        delete reference.light;
    }
    if (!reference.dark) {
        delete reference.dark;
    }
    if (!reference.light && !reference.dark) {
        return fallback
            ? typeof fallback === "string"
                ? fallback
                : { ...fallback }
            : fallback;
    }
    return reference;
}
function appearanceReferenceToName(value, fallback) {
    if (typeof value === "string") {
        return value;
    }
    if (value && typeof value === "object") {
        return value.dark ?? value.light ?? fallback;
    }
    return fallback;
}
function normalizeFont(value, fallback) {
    if (!isRecord(value)) {
        return fallback ? { ...fallback } : fallback;
    }
    const font = {
        ...value,
    };
    const size = pickNumber(value.size);
    font.face = pickString(value.face);
    font.size = size;
    font.weight =
        typeof value.weight === "string" || typeof value.weight === "number"
            ? value.weight
            : undefined;
    if (!font.face && typeof font.size === "undefined" && typeof font.weight === "undefined") {
        return fallback ? { ...fallback } : fallback;
    }
    return font;
}
function normalizeProfile(value, fallback) {
    if (!isRecord(value)) {
        return { ...fallback };
    }
    return {
        ...value,
        guid: pickString(value.guid),
        name: pickString(value.name, fallback.name) ?? fallback.name,
        commandline: pickString(value.commandline),
        startingDirectory: pickString(value.startingDirectory),
        colorScheme: normalizeAppearanceReference(value.colorScheme),
        tabTitle: pickString(value.tabTitle),
        tabColor: pickString(value.tabColor),
        hidden: typeof value.hidden === "boolean" ? value.hidden : undefined,
        font: normalizeFont(value.font),
        opacity: pickNumber(value.opacity),
        useAcrylic: typeof value.useAcrylic === "boolean" ? value.useAcrylic : undefined,
    };
}
function normalizeProfilePatch(value, fallback) {
    if (!isRecord(value)) {
        return { ...fallback };
    }
    return {
        ...value,
        guid: pickString(value.guid),
        name: pickString(value.name),
        commandline: pickString(value.commandline),
        startingDirectory: pickString(value.startingDirectory),
        colorScheme: normalizeAppearanceReference(value.colorScheme),
        tabTitle: pickString(value.tabTitle),
        tabColor: pickString(value.tabColor),
        hidden: typeof value.hidden === "boolean" ? value.hidden : undefined,
        font: normalizeFont(value.font),
        opacity: pickNumber(value.opacity),
        useAcrylic: typeof value.useAcrylic === "boolean" ? value.useAcrylic : undefined,
    };
}
function normalizeScheme(value) {
    if (!isRecord(value) || !isString(value.name)) {
        return null;
    }
    const scheme = {
        ...value,
        name: value.name,
    };
    const keys = [
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
        scheme[key] = isString(value[key]) ? value[key] : undefined;
    }
    return scheme;
}
function normalizeThemeWindow(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    return {
        ...value,
        applicationTheme: value.applicationTheme === "system" ||
            value.applicationTheme === "dark" ||
            value.applicationTheme === "light"
            ? value.applicationTheme
            : undefined,
        useMica: typeof value.useMica === "boolean" ? value.useMica : undefined,
    };
}
function normalizeThemeTabRow(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    return {
        ...value,
        background: pickString(value.background),
        unfocusedBackground: pickString(value.unfocusedBackground),
    };
}
function normalizeThemeTab(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    return {
        ...value,
        background: pickString(value.background),
        unfocusedBackground: pickString(value.unfocusedBackground),
        showCloseButton: value.showCloseButton === "always" ||
            value.showCloseButton === "hover" ||
            value.showCloseButton === "never" ||
            value.showCloseButton === "activeOnly"
            ? value.showCloseButton
            : undefined,
    };
}
function normalizeTheme(value) {
    if (!isRecord(value) || !isString(value.name)) {
        return null;
    }
    return {
        ...value,
        name: value.name,
        window: normalizeThemeWindow(value.window),
        tabRow: normalizeThemeTabRow(value.tabRow),
        tab: normalizeThemeTab(value.tab),
    };
}
function mergeProfile(defaults, profile) {
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
function createDefaultTerminalSettings(startingDirectory) {
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
function normalizeThemeReference(value, fallback) {
    return normalizeAppearanceReference(value, fallback);
}
function themeReferenceToName(theme) {
    return appearanceReferenceToName(theme, DEFAULT_THEME_NAME);
}
function themeReferenceToId(theme) {
    if (typeof theme === "string" || !theme || typeof theme !== "object") {
        return theme ?? DEFAULT_THEME_NAME;
    }
    const light = theme.light ?? "";
    const dark = theme.dark ?? "";
    return `${AUTO_THEME_PREFIX}${light}|${dark}`;
}
function themeReferenceToLabel(theme) {
    if (typeof theme === "string" || !theme || typeof theme !== "object") {
        return theme ?? DEFAULT_THEME_NAME;
    }
    const light = theme.light?.trim();
    const dark = theme.dark?.trim();
    if (light && dark && light !== dark) {
        return `Auto (${light} / ${dark})`;
    }
    const single = dark ?? light;
    return single ? `Auto (${single})` : "Auto";
}
function themeIdToReference(themeId) {
    if (!themeId.startsWith(AUTO_THEME_PREFIX)) {
        return themeId;
    }
    const payload = themeId.slice(AUTO_THEME_PREFIX.length);
    const [lightRaw = "", darkRaw = ""] = payload.split("|");
    const light = lightRaw.trim();
    const dark = darkRaw.trim();
    return {
        light: light || undefined,
        dark: dark || undefined,
    };
}
function normalizeTerminalSettings(value, startingDirectory) {
    const fallback = createDefaultTerminalSettings(startingDirectory);
    if (!isRecord(value)) {
        return fallback;
    }
    const defaults = normalizeProfilePatch(value.profiles && isRecord(value.profiles) ? value.profiles.defaults : undefined, fallback.profiles?.defaults ?? {});
    const fallbackProfile = mergeProfile(defaults, fallback.profiles?.list?.[0]);
    const listSource = value.profiles && isRecord(value.profiles) && Array.isArray(value.profiles.list)
        ? value.profiles.list
        : fallback.profiles?.list ?? [];
    const list = listSource
        .map((entry) => normalizeProfile(entry, fallbackProfile))
        .filter((profile) => profile.name.trim().length > 0);
    const schemesSource = Array.isArray(value.schemes) ? value.schemes : fallback.schemes ?? [];
    const schemes = schemesSource
        .map(normalizeScheme)
        .filter((entry) => Boolean(entry));
    const themesSource = Array.isArray(value.themes) ? value.themes : fallback.themes ?? [];
    const themes = themesSource
        .map(normalizeTheme)
        .filter((entry) => Boolean(entry));
    const theme = normalizeThemeReference(value.theme, fallback.theme);
    const tabWidthMode = value.tabWidthMode === "equal" ||
        value.tabWidthMode === "titleLength" ||
        value.tabWidthMode === "compact"
        ? value.tabWidthMode
        : fallback.tabWidthMode;
    return {
        ...value,
        $schema: pickString(value.$schema, fallback.$schema),
        defaultProfile: pickString(value.defaultProfile, fallback.defaultProfile),
        theme,
        alwaysShowTabs: pickBoolean(value.alwaysShowTabs, fallback.alwaysShowTabs ?? true),
        showTabsInTitlebar: pickBoolean(value.showTabsInTitlebar, fallback.showTabsInTitlebar ?? false),
        useAcrylicInTabRow: pickBoolean(value.useAcrylicInTabRow, fallback.useAcrylicInTabRow ?? false),
        tabWidthMode,
        profiles: {
            ...(value.profiles && isRecord(value.profiles) ? value.profiles : {}),
            defaults,
            list: list.length > 0 ? list : fallback.profiles?.list ?? [],
        },
        schemes: schemes.length > 0 ? schemes : fallback.schemes,
        themes: themes.length > 0 ? themes : fallback.themes,
    };
}
function resolveTerminalProfile(settings) {
    const defaults = settings.profiles?.defaults;
    const list = settings.profiles?.list ?? [];
    const active = list.find((profile) => !profile.hidden &&
        (profile.guid === settings.defaultProfile || profile.name === settings.defaultProfile)) ??
        list.find((profile) => !profile.hidden) ??
        list[0];
    return mergeProfile(defaults, active);
}
function resolveTerminalScheme(settings) {
    const profile = resolveTerminalProfile(settings);
    const schemeName = appearanceReferenceToName(profile.colorScheme ?? settings.profiles?.defaults?.colorScheme, DEFAULT_SCHEME_NAME);
    const scheme = settings.schemes?.find((entry) => entry.name === schemeName) ??
        settings.schemes?.[0] ??
        DEFAULT_SCHEME;
    return {
        ...DEFAULT_SCHEME,
        ...scheme,
    };
}
function resolveTerminalTheme(settings) {
    const themeName = themeReferenceToName(settings.theme);
    const theme = BUILTIN_THEMES[themeName] ??
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
function getTerminalStartingDirectory(settings) {
    const profile = resolveTerminalProfile(settings);
    return (profile.startingDirectory ??
        settings.profiles?.defaults?.startingDirectory ??
        null);
}
function buildTerminalUiPalette(settings) {
    const profile = resolveTerminalProfile(settings);
    const scheme = resolveTerminalScheme(settings);
    const theme = resolveTerminalTheme(settings);
    const terminalBackground = scheme.background ?? DEFAULT_SCHEME.background ?? "#000000";
    const terminalForeground = scheme.foreground ?? DEFAULT_SCHEME.foreground ?? "#f5f5f5";
    const resolveThemeColor = (value, fallback) => {
        if (!value) {
            return fallback;
        }
        if (value === "terminalBackground") {
            return terminalBackground;
        }
        if (value === "accent") {
            return "#0078d4";
        }
        return value;
    };
    return {
        fontFace: profile.font?.face ?? settings.profiles?.defaults?.font?.face ?? "Cascadia Mono",
        terminalBackground,
        terminalForeground,
        terminalMuted: scheme.brightBlack ?? "#8c8c8c",
        terminalBorder: scheme.brightBlack ?? "#2a2a2a",
        railBackground: resolveThemeColor(theme.tabRow?.background, "#ffffff"),
        railForeground: "#111111",
        railBorder: "#cfcfcf",
        activeTabBackground: resolveThemeColor(theme.tab?.background, "#ffffff"),
        activeTabForeground: "#111111",
        inactiveTabBackground: resolveThemeColor(theme.tab?.unfocusedBackground, "#f4f4f4"),
        inactiveTabForeground: "#555555",
        windowTheme: theme.window?.applicationTheme ?? "light",
    };
}
function serializeTerminalSettings(settings) {
    return `${JSON.stringify(settings, null, 2)}\n`;
}
function getProfileId(profile) {
    return profile.guid ?? profile.name;
}
function getProfileLabel(profile) {
    return profile.tabTitle ?? profile.name;
}
function getThemeOptions(settings) {
    const names = new Map();
    for (const name of BUILTIN_THEME_NAMES) {
        names.set(name, name);
    }
    for (const theme of settings.themes ?? []) {
        names.set(theme.name, theme.name);
    }
    if (settings.theme && typeof settings.theme === "object") {
        names.set(themeReferenceToId(settings.theme), themeReferenceToLabel(settings.theme));
    }
    return [...names.entries()].map(([id, label]) => ({
        id,
        label,
    }));
}
function getDefaultWindowsTerminalSettingsText(startingDirectory) {
    return serializeTerminalSettings(createDefaultTerminalSettings(startingDirectory));
}
function stringifyWindowsTerminalSettings(settings) {
    return serializeTerminalSettings(normalizeTerminalSettings(settings));
}
function updateDefaultProfile(settings, profileId) {
    const normalized = normalizeTerminalSettings(settings);
    const nextDefault = normalized.profiles?.list?.find((profile) => getProfileId(profile) === profileId || profile.name === profileId) ?? normalized.profiles?.list?.[0];
    return {
        ...normalized,
        defaultProfile: nextDefault ? getProfileId(nextDefault) : normalized.defaultProfile,
    };
}
function updateThemeName(settings, themeName) {
    const normalized = normalizeTerminalSettings(settings);
    return {
        ...normalized,
        theme: themeIdToReference(themeName),
    };
}
function buildParsedAppearance(settings) {
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
        themeName: themeReferenceToId(settings.theme),
        availableProfiles: availableProfiles.length > 0
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
function parseWindowsTerminalSettingsText(text) {
    try {
        const parsed = JSON.parse(text);
        const settings = normalizeTerminalSettings(parsed);
        return {
            settings,
            appearance: buildParsedAppearance(settings),
            error: null,
        };
    }
    catch (error) {
        const settings = createDefaultTerminalSettings();
        return {
            settings,
            appearance: buildParsedAppearance(settings),
            error: error instanceof Error ? error.message : "Invalid JSON.",
        };
    }
}
