"use client";

import { useEffect, useState, type KeyboardEventHandler, type RefObject } from "react";

import type { SlashCommandDefinition } from "@/lib/shared";

type SessionOption = {
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
  showToolbar?: boolean;
  isPhoneLayout: boolean;
  sessionSummary: string;
  selectedModel: string;
  selectedEffort: string;
  fastMode: boolean;
  planMode: boolean;
  utilityActionLabel?: string | null;
  showUtilityAction?: boolean;
  modelOptions: SessionOption[];
  effortOptions: SessionOption[];
  labels: {
    model: string;
    reasoning: string;
    mode: string;
    fast: string;
    plan: string;
    on: string;
    off: string;
    session: string;
    showSettings: string;
    hideSettings: string;
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
  onFastModeChange: (enabled: boolean) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onUtilityAction?: (() => void) | null;
  onSubmit: () => void;
  onInterrupt: () => void;
};

type SessionSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: SessionOption[];
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
  showToolbar = true,
  isPhoneLayout,
  sessionSummary,
  selectedModel,
  selectedEffort,
  fastMode,
  planMode,
  utilityActionLabel = null,
  showUtilityAction = false,
  modelOptions,
  effortOptions,
  labels,
  onComposerChange,
  onComposerKeyDown,
  onCommandPick,
  onModelChange,
  onEffortChange,
  onFastModeChange,
  onPlanModeChange,
  onUtilityAction = null,
  onSubmit,
  onInterrupt,
}: ComposerDockProps) {
  const [mobileSessionExpanded, setMobileSessionExpanded] = useState(!isPhoneLayout);

  useEffect(() => {
    setMobileSessionExpanded(!isPhoneLayout);
  }, [isPhoneLayout]);

  const showSessionControls = !isPhoneLayout || mobileSessionExpanded;
  const showCompactSessionTrigger =
    isPhoneLayout && !showToolbar && !mobileSessionExpanded;

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
        {showCompactSessionTrigger ? (
          <div className="composer-compact-row">
            <button
              className="plain-action composer-compact-trigger"
              type="button"
              onClick={() => {
                setMobileSessionExpanded(true);
              }}
            >
              {labels.session}
            </button>

            {showUtilityAction && utilityActionLabel && onUtilityAction ? (
              <button
                className="plain-action composer-mobile-utility"
                type="button"
                onClick={onUtilityAction}
              >
                {utilityActionLabel}
              </button>
            ) : null}
          </div>
        ) : isPhoneLayout ? (
          <div className="composer-mobile-topbar">
            <button
              className={`plain-action composer-mobile-session-toggle ${
                mobileSessionExpanded ? "expanded" : ""
              }`}
              type="button"
              aria-expanded={mobileSessionExpanded}
              onClick={() => {
                setMobileSessionExpanded((current) => !current);
              }}
            >
              <span className="composer-mobile-session-copy">
                <span className="composer-control-label">{labels.session}</span>
                <span className="composer-mobile-session-summary" title={sessionSummary}>
                  {sessionSummary}
                </span>
              </span>
              <span className="composer-mobile-session-toggle-text">
                {mobileSessionExpanded ? labels.hideSettings : labels.showSettings}
              </span>
            </button>

            {showUtilityAction && utilityActionLabel && onUtilityAction ? (
              <button
                className="plain-action composer-mobile-utility"
                type="button"
                onClick={onUtilityAction}
              >
                {utilityActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}

        {showSessionControls ? (
          <div className="composer-controls" role="group" aria-label={labels.mode}>
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

            <div className="composer-mode-field" role="group" aria-label={labels.mode}>
              <span className="composer-control-label">{labels.mode}</span>
              <div className="composer-mode-group">
                <button
                  className={`picker-chip ${fastMode ? "selected" : ""}`}
                  type="button"
                  aria-pressed={fastMode}
                  onClick={() => onFastModeChange(!fastMode)}
                >
                  <span>{labels.fast}</span>
                  <span className="composer-mode-state">
                    {fastMode ? labels.on : labels.off}
                  </span>
                </button>
                <button
                  className={`picker-chip ${planMode ? "selected" : ""}`}
                  type="button"
                  aria-pressed={planMode}
                  onClick={() => onPlanModeChange(!planMode)}
                >
                  <span>{labels.plan}</span>
                  <span className="composer-mode-state">
                    {planMode ? labels.on : labels.off}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="composer-input-row">
          <textarea
            ref={composerRef}
            value={composer}
            onChange={(event) => onComposerChange(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={labels.placeholder}
            className="composer-input"
          />

          <div className="composer-actions">
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

        {showToolbar ? (
          isPhoneLayout ? (
            <div className="composer-toolbar phone-only-status">
              <span className="composer-inline-status" aria-live="polite">
                {statusText}
              </span>
            </div>
          ) : (
            <div className="composer-toolbar">
              <span className="composer-inline-status" aria-live="polite">
                {statusText}
              </span>
              <span className="composer-helper">{helperText}</span>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
