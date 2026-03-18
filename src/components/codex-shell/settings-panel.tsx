"use client";

import type { UiLanguage } from "@/components/codex-shell/copy";

type SettingsOption = {
  value: string;
  label: string;
};

type SettingsPanelProps = {
  selectedLanguage: UiLanguage;
  languageOptions: SettingsOption[];
  selectedProfile: string;
  profileOptions: SettingsOption[];
  selectedTheme: string;
  themeOptions: SettingsOption[];
  settingsJson: string;
  settingsError: string | null;
  saveDisabled: boolean;
  labels: {
    interfaceTitle: string;
    language: string;
    applyHint: string;
    profileTitle: string;
    profile: string;
    theme: string;
    configTitle: string;
    configHint: string;
    rawJson: string;
    save: string;
    reset: string;
  };
  onLanguageChange: (language: UiLanguage) => void;
  onProfileChange: (profileId: string) => void;
  onThemeChange: (themeId: string) => void;
  onSettingsJsonChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
};

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: SettingsOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-field" htmlFor={id}>
      <span className="settings-field-label">{label}</span>
      <span className="settings-select-shell">
        <select
          id={id}
          className="settings-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
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
  );
}

export function SettingsPanel({
  selectedLanguage,
  languageOptions,
  selectedProfile,
  profileOptions,
  selectedTheme,
  themeOptions,
  settingsJson,
  settingsError,
  saveDisabled,
  labels,
  onLanguageChange,
  onProfileChange,
  onThemeChange,
  onSettingsJsonChange,
  onSave,
  onReset,
}: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <section className="settings-section settings-section-interface">
        <div className="settings-section-head">
          <span className="home-section-label">{labels.interfaceTitle}</span>
          <span className="settings-section-note">{labels.applyHint}</span>
        </div>

        <SelectField
          id="settings-language"
          label={labels.language}
          value={selectedLanguage}
          options={languageOptions}
          onChange={(value) => onLanguageChange(value as UiLanguage)}
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="home-section-label">{labels.profileTitle}</span>
          <span className="settings-section-note">{labels.configHint}</span>
        </div>

        <SelectField
          id="settings-profile"
          label={labels.profile}
          value={selectedProfile}
          options={profileOptions}
          onChange={onProfileChange}
        />

        <SelectField
          id="settings-theme"
          label={labels.theme}
          value={selectedTheme}
          options={themeOptions}
          onChange={onThemeChange}
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="home-section-label">{labels.configTitle}</span>
          <span className="settings-section-note">{labels.configHint}</span>
        </div>

        <label className="settings-field" htmlFor="settings-json">
          <span className="settings-field-label">{labels.rawJson}</span>
          <textarea
            id="settings-json"
            className="raw-json-editor"
            rows={18}
            spellCheck={false}
            value={settingsJson}
            onChange={(event) => onSettingsJsonChange(event.target.value)}
          />
        </label>

        {settingsError ? <div className="settings-error">{settingsError}</div> : null}

        <div className="settings-actions">
          <button
            className="action-button"
            type="button"
            disabled={saveDisabled}
            onClick={onSave}
          >
            {labels.save}
          </button>
          <button className="plain-action" type="button" onClick={onReset}>
            {labels.reset}
          </button>
        </div>
      </section>
    </div>
  );
}
