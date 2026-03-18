"use client";

import type { UiLanguage } from "@/components/codex-shell/copy";

type SettingsOption = {
  value: string;
  label: string;
};

type SettingsPanelProps = {
  selectedLanguage: UiLanguage;
  languageOptions: SettingsOption[];
  labels: {
    interfaceTitle: string;
    language: string;
    applyHint: string;
  };
  onLanguageChange: (language: UiLanguage) => void;
};

export function SettingsPanel({
  selectedLanguage,
  languageOptions,
  labels,
  onLanguageChange,
}: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <section className="settings-section settings-section-interface">
        <div className="settings-section-head">
          <span className="home-section-label">{labels.interfaceTitle}</span>
          <span className="settings-section-note">{labels.applyHint}</span>
        </div>

        <label className="settings-field" htmlFor="settings-language">
          <span className="settings-field-label">{labels.language}</span>
          <span className="settings-select-shell">
            <select
              id="settings-language"
              className="settings-select"
              value={selectedLanguage}
              onChange={(event) => onLanguageChange(event.target.value as UiLanguage)}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="settings-select-caret" aria-hidden="true">
              v
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
