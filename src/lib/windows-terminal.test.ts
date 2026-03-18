import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTerminalSettings,
  parseWindowsTerminalSettingsText,
  stringifyWindowsTerminalSettings,
  updateThemeName,
} from "@/lib/windows-terminal";

test("normalizeTerminalSettings preserves unknown Windows Terminal keys", () => {
  const normalized = normalizeTerminalSettings({
    copyOnSelect: false,
    colorSchemeSelectionMode: "auto",
    profiles: {
      defaults: {
        font: {
          face: "Cascadia Mono",
          ligatures: false,
        },
        opacity: 92,
      },
      list: [
        {
          guid: "{11111111-1111-1111-1111-111111111111}",
          name: "PowerShell",
          source: "Windows.Terminal.PowershellCore",
          customFlag: true,
        },
      ],
    },
    actions: [
      {
        command: {
          action: "newTab",
          profile: "PowerShell",
        },
        keys: "ctrl+shift+t",
      },
    ],
    themes: [
      {
        name: "custom-flat",
        tab: {
          background: "#ffffff",
        },
        extraSurface: "#f7f7f7",
      },
    ],
  });

  const saved = JSON.parse(stringifyWindowsTerminalSettings(normalized)) as Record<string, any>;

  assert.equal(saved.copyOnSelect, false);
  assert.equal(saved.colorSchemeSelectionMode, "auto");
  assert.equal(saved.actions[0].keys, "ctrl+shift+t");
  assert.equal(saved.profiles.defaults.font.ligatures, false);
  assert.equal(saved.profiles.list[0].source, "Windows.Terminal.PowershellCore");
  assert.equal(saved.profiles.list[0].customFlag, true);
  assert.equal(saved.themes[0].extraSurface, "#f7f7f7");
});

test("theme parsing accepts reserved names and theme objects", () => {
  const reserved = parseWindowsTerminalSettingsText(
    JSON.stringify({
      theme: "dark",
    }),
  );
  assert.equal(reserved.settings.theme, "dark");

  const paired = parseWindowsTerminalSettingsText(
    JSON.stringify({
      theme: {
        light: "light",
        dark: "dark",
      },
    }),
  );

  assert.deepEqual(paired.settings.theme, {
    light: "light",
    dark: "dark",
  });
  assert.ok(
    paired.appearance.availableThemes.some((theme) => theme.id === "__auto__:light|dark"),
  );

  const updated = updateThemeName(paired.settings, "__auto__:light|dark");
  assert.deepEqual(updated.theme, {
    light: "light",
    dark: "dark",
  });
});

test("normalizeTerminalSettings preserves unresolved theme and color scheme references", () => {
  const normalized = normalizeTerminalSettings({
    defaultProfile: "{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}",
    theme: {
      light: "custom-light",
      dark: "custom-dark",
    },
    profiles: {
      list: [
        {
          guid: "{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}",
          name: "Imported",
          colorScheme: {
            light: "Solarized Light",
            dark: "Campbell",
          },
        },
      ],
    },
  });

  const saved = JSON.parse(stringifyWindowsTerminalSettings(normalized)) as Record<string, any>;

  assert.equal(saved.defaultProfile, "{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}");
  assert.deepEqual(saved.theme, {
    light: "custom-light",
    dark: "custom-dark",
  });
  assert.deepEqual(saved.profiles.list[0].colorScheme, {
    light: "Solarized Light",
    dark: "Campbell",
  });
});
