"use client";

import type { UiLanguage } from "@/components/codex-shell/copy";

type SettingsOption = {
  value: string;
  label: string;
};

type SettingsFact = {
  label: string;
  value: string;
};

type SettingsPanelProps = {
  selectedLanguage: UiLanguage;
  languageOptions: SettingsOption[];
  facts: SettingsFact[];
  shortcuts: readonly string[];
  labels: {
    interfaceTitle: string;
    language: string;
    sessionTitle: string;
    shortcutsTitle: string;
    applyHint: string;
  };
  onLanguageChange: (language: UiLanguage) => void;
};

export function SettingsPanel({
  selectedLanguage,
  languageOptions,
  facts,
  shortcuts,
  labels,
  onLanguageChange,
}: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <section className="settings-section">
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

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="home-section-label">{labels.sessionTitle}</span>
        </div>

        <div className="settings-fact-grid">
          {facts.map((fact) => (
            <div key={fact.label} className="settings-fact">
              <span className="settings-fact-label">{fact.label}</span>
              <strong className="settings-fact-value">{fact.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="home-section-label">{labels.shortcutsTitle}</span>
        </div>

        <div className="settings-shortcut-list">
          {shortcuts.map((shortcut) => (
            <div key={shortcut} className="settings-shortcut-row">
              {shortcut}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
