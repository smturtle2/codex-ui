"use client";

import {
  type KeyboardEventHandler,
  type RefObject,
} from "react";

import type { UiLanguage } from "@/components/codex-shell/copy";
import type { SlashCommandDefinition } from "@/lib/shared";

type SessionModelOption = {
  value: string;
  label: string;
};

type SessionEffortOption = {
  value: string;
  label: string;
};

type ComposerDockProps = {
  composer: string;
  visibleCommands: SlashCommandDefinition[];
  selectedCommandIndex: number;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  modelSelectRef: RefObject<HTMLSelectElement | null>;
  helperText: string;
  statusText: string;
  canSubmit: boolean;
  activeTurn: boolean;
  selectedModel: string;
  selectedEffort: string;
  selectedLanguage: UiLanguage;
  planMode: boolean;
  modelOptions: SessionModelOption[];
  effortOptions: SessionEffortOption[];
  languageOptions: SessionModelOption[];
  labels: {
    session: string;
    model: string;
    reasoning: string;
    language: string;
    status: string;
    shortcuts: string;
    plan: string;
    on: string;
    off: string;
    placeholder: string;
    interrupt: string;
    send: string;
    unavailable: string;
  };
  onComposerChange: (value: string) => void;
  onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onCommandPick: (commandName: string) => void;
  onModelChange: (value: string) => void;
  onEffortChange: (value: string) => void;
  onLanguageChange: (value: UiLanguage) => void;
  onPlanModeToggle: () => void;
  onSurfaceOpen: (surface: "status" | "shortcuts") => void;
  onSubmit: () => void;
  onInterrupt: () => void;
};

type SessionSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  unavailableLabel: string;
  selectRef?: RefObject<HTMLSelectElement | null>;
  onChange: (value: string) => void;
};

function SessionSelectField({
  id,
  label,
  value,
  options,
  unavailableLabel,
  selectRef,
  onChange,
}: SessionSelectFieldProps) {
  const normalizedOptions =
    options.length > 0
      ? options
      : [{ value: value || "__unavailable__", label: value || unavailableLabel }];

  return (
    <label className="composer-select-field" htmlFor={id}>
      <span className="composer-control-label">{label}</span>
      <span className="composer-select-shell">
        <select
          ref={selectRef}
          id={id}
          className="composer-select"
          value={value || normalizedOptions[0].value}
          disabled={options.length === 0}
          onChange={(event) => onChange(event.target.value)}
        >
          {normalizedOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="composer-select-caret" aria-hidden="true">
          v
        </span>
      </span>
    </label>
  );
}

export function ComposerDock({
  composer,
  visibleCommands,
  selectedCommandIndex,
  composerRef,
  modelSelectRef,
  helperText,
  statusText,
  canSubmit,
  activeTurn,
  selectedModel,
  selectedEffort,
  selectedLanguage,
  planMode,
  modelOptions,
  effortOptions,
  languageOptions,
  labels,
  onComposerChange,
  onComposerKeyDown,
  onCommandPick,
  onModelChange,
  onEffortChange,
  onLanguageChange,
  onPlanModeToggle,
  onSurfaceOpen,
  onSubmit,
  onInterrupt,
}: ComposerDockProps) {
  return (
    <section className="composer-dock">
      {visibleCommands.length > 0 ? (
        <div className="command-menu" role="listbox" aria-label="Slash commands">
          {visibleCommands.map((command, index) => (
            <button
              key={command.name}
              type="button"
              className={`command-menu-row ${
                index === selectedCommandIndex ? "selected" : ""
              }`}
              aria-selected={index === selectedCommandIndex}
              onClick={() => onCommandPick(command.name)}
            >
              <span className="command-menu-main">/{command.name}</span>
              <span className="command-menu-copy">{command.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="composer-frame">
        <div className="composer-controls" aria-label={labels.session}>
          <div className="composer-controls-grid">
            <SessionSelectField
              id="composer-model"
              label={labels.model}
              value={selectedModel}
              options={modelOptions}
              unavailableLabel={labels.unavailable}
              selectRef={modelSelectRef}
              onChange={onModelChange}
            />

            <SessionSelectField
              id="composer-effort"
              label={labels.reasoning}
              value={selectedEffort}
              options={effortOptions}
              unavailableLabel={labels.unavailable}
              onChange={onEffortChange}
            />

            <SessionSelectField
              id="composer-language"
              label={labels.language}
              value={selectedLanguage}
              options={languageOptions}
              unavailableLabel={labels.unavailable}
              onChange={(value) => onLanguageChange(value as UiLanguage)}
            />

            <label className="composer-plan-field">
              <span className="composer-control-label">{labels.plan}</span>
              <button
                className={`composer-plan-toggle ${planMode ? "selected" : ""}`}
                type="button"
                aria-pressed={planMode}
                onClick={onPlanModeToggle}
              >
                <span className="composer-plan-toggle-value">
                  {planMode ? labels.on : labels.off}
                </span>
              </button>
            </label>
          </div>
        </div>

        <textarea
          ref={composerRef}
          value={composer}
          onChange={(event) => onComposerChange(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder={labels.placeholder}
          className="composer-input"
        />

        <div className="composer-toolbar">
          <div className="composer-meta">
            <span className="composer-inline-status" aria-live="polite">
              {statusText}
            </span>
            <span className="composer-helper">{helperText}</span>
          </div>
          <div className="composer-actions">
            <button
              className="plain-action composer-utility-action"
              type="button"
              onClick={() => onSurfaceOpen("status")}
            >
              {labels.status}
            </button>
            <button
              className="plain-action composer-utility-action"
              type="button"
              onClick={() => onSurfaceOpen("shortcuts")}
            >
              {labels.shortcuts}
            </button>
            {activeTurn ? (
              <button className="plain-action" type="button" onClick={onInterrupt}>
                {labels.interrupt}
              </button>
            ) : null}
            <button
              className="action-button"
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {labels.send}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
