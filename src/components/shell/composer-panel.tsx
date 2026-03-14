import { useEffect, useMemo, useRef, useState } from "react";

import { ComposerAttachment } from "@/components/shell/shared";
import { compactWorkspaceBadge } from "@/lib/shell-ui";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type PickerKind = "image" | "skill" | "mention" | null;

function closeClosestMenu(target: EventTarget | null) {
  if (target instanceof HTMLElement) {
    target.closest("details")?.removeAttribute("open");
  }
}

export function ComposerPanel({
  skills,
  apps,
  selectedThreadId,
  sending,
  focusToken,
  prefillText,
  prefillToken,
  draftWorkspacePath,
  onOpenWorkspace,
  onSend,
}: {
  skills: unknown[];
  apps: unknown[];
  selectedThreadId: string | null;
  sending: boolean;
  focusToken: number;
  prefillText: string;
  prefillToken: number;
  draftWorkspacePath: string;
  onOpenWorkspace: () => void;
  onSend: (payload: { message: string; attachments: ComposerAttachment[] }) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [manualImagePath, setManualImagePath] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resolvedSkills = useMemo(
    () => skills as Array<{ name?: string; path?: string; description?: string }>,
    [skills],
  );
  const resolvedApps = useMemo(() => apps, [apps]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    if (!prefillText) {
      return;
    }

    setMessage(prefillText);
    textareaRef.current?.focus();
  }, [prefillText, prefillToken]);

  function clearComposer() {
    setMessage("");
    setAttachments([]);
    setManualImagePath("");
    setPicker(null);
  }

  async function handleSend() {
    if (!message.trim() && attachments.length === 0) {
      return;
    }

    await onSend({
      message: message.trim(),
      attachments,
    });
    clearComposer();
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((entry) => entry.id !== attachmentId));
  }

  return (
    <div className="composer-shell">
      <div className="composer-panel">
        <div className="composer-topbar">
          <button className="workspace-pill" onClick={onOpenWorkspace}>
            <span className="workspace-pill-name">{compactWorkspaceBadge(draftWorkspacePath)}</span>
            <span className="workspace-pill-path">{draftWorkspacePath}</span>
          </button>
          <span className="composer-hint">Ctrl or Cmd + Enter to send</span>
        </div>

        {attachments.length > 0 ? (
          <div className="attachment-row">
            {attachments.map((attachment) => (
              <div className="attachment-chip" key={attachment.id}>
                <span>{attachment.label}</span>
                <button className="chip-dismiss" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.label}`}>
                  x
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {picker === "image" ? (
          <div className="composer-picker">
            <div className="path-input-row">
              <input
                className="text-input"
                placeholder="/absolute/path/to/image.png"
                value={manualImagePath}
                onChange={(event) => setManualImagePath(event.target.value)}
              />
              <button
                className="ghost-button"
                onClick={() => {
                  if (!manualImagePath.trim()) {
                    return;
                  }
                  setAttachments((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      type: "localImage",
                      label: manualImagePath.trim().split("/").pop() || manualImagePath.trim(),
                      path: manualImagePath.trim(),
                    },
                  ]);
                  setManualImagePath("");
                  setPicker(null);
                }}
              >
                Add image
              </button>
            </div>
          </div>
        ) : null}

        {picker === "skill" ? (
          <div className="composer-picker catalog-list">
            {resolvedSkills.map((skill, index) => (
              <button
                className="catalog-item"
                key={`${skill.name ?? "skill"}-${index}`}
                onClick={() => {
                  setAttachments((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      type: "skill",
                      label: skill.name ?? skill.path ?? "skill",
                      name: skill.name ?? "skill",
                      path: skill.path ?? "",
                    },
                  ]);
                  setPicker(null);
                }}
              >
                <strong>{skill.name ?? skill.path ?? "skill"}</strong>
                <div>{skill.description ?? skill.path ?? ""}</div>
              </button>
            ))}
          </div>
        ) : null}

        {picker === "mention" ? (
          <div className="composer-picker catalog-list">
            {resolvedApps.map((app, index) => {
              const resolved = isObject(app) ? app : {};
              const name = typeof resolved.name === "string" ? resolved.name : typeof resolved.id === "string" ? resolved.id : "app";
              const description = typeof resolved.description === "string" ? resolved.description : typeof resolved.id === "string" ? resolved.id : "";

              return (
                <button
                  className="catalog-item"
                  key={`${name}-${index}`}
                  onClick={() => {
                    setAttachments((current) => [
                      ...current,
                      {
                        id: crypto.randomUUID(),
                        type: "mention",
                        label: name,
                        name,
                        path: name,
                      },
                    ]);
                    setPicker(null);
                  }}
                >
                  <strong>{name}</strong>
                  <div>{description}</div>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="composer-input-shell">
          <textarea
            ref={textareaRef}
            className="composer-input"
            placeholder={selectedThreadId ? "Reply to Codex..." : "Message Codex about this workspace..."}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleSend();
              }
            }}
          />

          <div className="composer-footer">
            <details className="composer-plus-menu">
              <summary className="icon-button" aria-label="Add attachment or tool">
                +
              </summary>
              <div className="composer-plus-panel">
                <button
                  className="menu-item"
                  onClick={(event) => {
                    closeClosestMenu(event.currentTarget);
                    setPicker("image");
                  }}
                >
                  Add image
                </button>
                <button
                  className="menu-item"
                  onClick={(event) => {
                    closeClosestMenu(event.currentTarget);
                    setPicker("skill");
                  }}
                >
                  Insert skill
                </button>
                <button
                  className="menu-item"
                  onClick={(event) => {
                    closeClosestMenu(event.currentTarget);
                    setPicker("mention");
                  }}
                >
                  Mention app
                </button>
              </div>
            </details>

            <button className="button send-button" onClick={() => void handleSend()} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
