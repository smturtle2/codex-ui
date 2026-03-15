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
  modelTriggerRef: RefObject<HTMLButtonElement | null>;
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

type ComposerMenuFieldProps = {
  kind: "model" | "effort";
  label: string;
  value: string;
  valueLabel: string;
  openMenu: "model" | "effort" | null;
  triggerRef: RefObject<HTMLButtonElement | null>;
  options: Array<{ value: string; label: string }>;
  onToggle: (kind: "model" | "effort") => void;
  onPick: (kind: "model" | "effort", value: string) => void;
};

function ComposerMenuField({
  kind,
  label,
  value,
  valueLabel,
  openMenu,
  triggerRef,
  options,
  onToggle,
  onPick,
}: ComposerMenuFieldProps) {
  return (
    <div className="composer-menu-shell">
      <span className="composer-control-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={`composer-control ${openMenu === kind ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={openMenu === kind}
        onClick={() => onToggle(kind)}
      >
        <span className="composer-control-value">{valueLabel}</span>
        <span className="composer-control-caret" aria-hidden="true">
          {openMenu === kind ? "−" : "+"}
        </span>
      </button>

      {openMenu === kind ? (
        <div className="composer-menu" role="listbox" aria-label={`${label} options`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`composer-menu-option ${
                option.value === value ? "selected" : ""
              }`}
              aria-selected={option.value === value}
              onClick={() => onPick(kind, option.value)}
            >
              <span>{option.label}</span>
              {option.value === value ? <span aria-hidden="true">•</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ComposerDock({
  composer,
  visibleCommands,
  selectedCommandIndex,
  composerRef,
  modelTriggerRef,
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
  const [openMenu, setOpenMenu] = useState<"model" | "effort" | null>(null);
  const effortTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenu) {
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

      setOpenMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
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
  }, [openMenu]);

  const selectedModelLabel =
    modelOptions.find((option) => option.value === selectedModel)?.label ??
    selectedModel;
  const selectedEffortLabel =
    effortOptions.find((option) => option.value === selectedEffort)?.label ??
    selectedEffort;

  function handleToggleMenu(kind: "model" | "effort") {
    setOpenMenu((current) => (current === kind ? null : kind));
  }

  function handlePick(kind: "model" | "effort", value: string) {
    setOpenMenu(null);

    if (kind === "model") {
      onModelChange(value);
      return;
    }

    onEffortChange(value);
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
        <div ref={menuRootRef} className="composer-topbar" aria-label="Session settings">
          <div className="composer-control-group">
            <ComposerMenuField
              kind="model"
              label="Model"
              value={selectedModel}
              valueLabel={selectedModelLabel}
              openMenu={openMenu}
              triggerRef={modelTriggerRef}
              options={modelOptions}
              onToggle={handleToggleMenu}
              onPick={handlePick}
            />

            <ComposerMenuField
              kind="effort"
              label="Reasoning"
              value={selectedEffort}
              valueLabel={selectedEffortLabel}
              openMenu={openMenu}
              triggerRef={effortTriggerRef}
              options={effortOptions}
              onToggle={handleToggleMenu}
              onPick={handlePick}
            />

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

          <div className="composer-status" aria-live="polite">
            <span className="composer-control-label">Status</span>
            <span>{statusText}</span>
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
