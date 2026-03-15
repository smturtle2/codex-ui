"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
  type RefObject,
} from "react";

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
  sessionTriggerRef: RefObject<HTMLButtonElement | null>;
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
  onSurfaceOpen: (surface: "status" | "shortcuts") => void;
  onSubmit: () => void;
  onInterrupt: () => void;
};

type SessionSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

function SessionSelectField({
  id,
  label,
  value,
  options,
  onChange,
}: SessionSelectFieldProps) {
  const normalizedOptions =
    options.length > 0
      ? options
      : [{ value: value || "__unavailable__", label: value || "Unavailable" }];

  return (
    <label className="composer-select-field" htmlFor={id}>
      <span className="composer-control-label">{label}</span>
      <span className="composer-select-shell">
        <select
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
  sessionTriggerRef,
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
  onSurfaceOpen,
  onSubmit,
  onInterrupt,
}: ComposerDockProps) {
  const [sessionOpen, setSessionOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sessionOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRootRef.current?.contains(target)) {
        return;
      }

      setSessionOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSessionOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sessionOpen]);

  const selectedModelLabel =
    modelOptions.find((option) => option.value === selectedModel)?.label ??
    selectedModel;
  const selectedEffortLabel =
    effortOptions.find((option) => option.value === selectedEffort)?.label ??
    selectedEffort;

  function handleSurfaceOpen(surface: "status" | "shortcuts") {
    setSessionOpen(false);
    onSurfaceOpen(surface);
  }

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
        <div ref={menuRootRef} className="composer-session-row" aria-label="Session settings">
          <div className="composer-session-shell">
            <button
              ref={sessionTriggerRef}
              type="button"
              className={`composer-session-trigger ${sessionOpen ? "open" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={sessionOpen}
              aria-label={`Model and reasoning controls. Current model ${selectedModelLabel}. Current reasoning ${selectedEffortLabel}.`}
              onClick={() => {
                setSessionOpen((current) => !current);
              }}
            >
              <span className="composer-session-copy">
                <span className="composer-control-label">Session</span>
                <span className="composer-session-value">
                  {selectedModelLabel} / {selectedEffortLabel}
                </span>
              </span>
              <span className="composer-control-caret" aria-hidden="true">
                {sessionOpen ? "^" : "v"}
              </span>
            </button>

            {sessionOpen ? (
              <div
                className="composer-session-panel"
                role="dialog"
                aria-label="Model and reasoning controls"
              >
                <div className="composer-session-grid">
                  <SessionSelectField
                    id="composer-model"
                    label="Model"
                    value={selectedModel}
                    options={modelOptions}
                    onChange={onModelChange}
                  />

                  <SessionSelectField
                    id="composer-effort"
                    label="Reasoning"
                    value={selectedEffort}
                    options={effortOptions}
                    onChange={onEffortChange}
                  />
                </div>

                <div className="composer-session-actions">
                  <button
                    className="plain-action"
                    type="button"
                    onClick={() => handleSurfaceOpen("status")}
                  >
                    Status
                  </button>
                  <button
                    className="plain-action"
                    type="button"
                    onClick={() => handleSurfaceOpen("shortcuts")}
                  >
                    Shortcuts
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            className={`composer-plan-toggle ${planMode ? "selected" : ""}`}
            type="button"
            aria-pressed={planMode}
            onClick={onPlanModeToggle}
          >
            <span className="composer-plan-toggle-label">Plan</span>
            <span className="composer-plan-toggle-value">{planMode ? "On" : "Off"}</span>
          </button>
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
          <div className="composer-meta">
            <span className="composer-inline-status" aria-live="polite">
              {statusText}
            </span>
            <span className="composer-helper">{helperText}</span>
          </div>
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
