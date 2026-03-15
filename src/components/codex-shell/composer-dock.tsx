"use client";

import type { KeyboardEventHandler, RefObject } from "react";

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
  planMode: boolean;
  modelOptions: SessionModelOption[];
  effortOptions: SessionEffortOption[];
  onComposerChange: (value: string) => void;
  onComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onCommandPick: (commandName: string) => void;
  onModelChange: (value: string) => void;
  onEffortChange: (value: string) => void;
  onPlanModeToggle: () => void;
  onSubmit: () => void;
  onInterrupt: () => void;
};

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
  planMode,
  modelOptions,
  effortOptions,
  onComposerChange,
  onComposerKeyDown,
  onCommandPick,
  onModelChange,
  onEffortChange,
  onPlanModeToggle,
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
        <div className="composer-settings" aria-label="Session settings">
          <label className="composer-setting">
            <span className="composer-setting-label">Model</span>
            <select
              ref={modelSelectRef}
              className="composer-setting-select"
              value={selectedModel}
              onChange={(event) => onModelChange(event.target.value)}
            >
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="composer-setting">
            <span className="composer-setting-label">Reasoning</span>
            <select
              className="composer-setting-select"
              value={selectedEffort}
              onChange={(event) => onEffortChange(event.target.value)}
            >
              {effortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className={`composer-plan-toggle ${planMode ? "selected" : ""}`}
            type="button"
            aria-pressed={planMode}
            onClick={onPlanModeToggle}
          >
            <span className="composer-plan-toggle-label">Plan</span>
            <span className="composer-plan-toggle-value">{planMode ? "On" : "Off"}</span>
          </button>

          <div className="composer-status" aria-live="polite">
            {statusText}
          </div>
        </div>

        <textarea
          ref={composerRef}
          value={composer}
          onChange={(event) => onComposerChange(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="Message Codex"
          className="composer-input"
        />

        <div className="composer-toolbar">
          <span className="composer-helper">{helperText}</span>
          <div className="composer-actions">
            {activeTurn ? (
              <button className="plain-action" type="button" onClick={onInterrupt}>
                Interrupt
              </button>
            ) : null}
            <button
              className="action-button"
              type="button"
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
