"use client";

import { forwardRef } from "react";

export type ApprovalOption = {
  key: string;
  label: string;
  onSelect: () => void;
};

export type ApprovalQuestion = {
  id: string;
  header: string;
  question: string;
  options: string[];
  allowsFreeform: boolean;
  value: string;
  onChange: (value: string) => void;
};

type ApprovalDialogProps = {
  title: string;
  intro: string;
  reason?: string | null;
  detail?: string | null;
  options: ApprovalOption[];
  selectedOptionIndex: number;
  questions: ApprovalQuestion[];
  submitLabel?: string | null;
  onSubmitQuestions?: (() => void) | null;
  requestDraft: string;
  onRequestDraftChange: (value: string) => void;
  onSendJson: () => void;
  footer: string | null;
  onCancel?: (() => void) | null;
};

export const ApprovalDialog = forwardRef<HTMLDivElement, ApprovalDialogProps>(
  function ApprovalDialog(
    {
      title,
      intro,
      reason = null,
      detail = null,
      options,
      selectedOptionIndex,
      questions,
      submitLabel = null,
      onSubmitQuestions = null,
      requestDraft,
      onRequestDraftChange,
      onSendJson,
      footer,
      onCancel = null,
    },
    ref,
  ) {
    return (
      <div className="screen-overlay modal-overlay">
        <section
          ref={ref}
          className="approval-modal"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-dialog-title"
        >
          <div className="surface-dialog-header">
            <div className="surface-dialog-copy">
              <span className="surface-dialog-kicker">Approval</span>
              <strong id="approval-dialog-title">{title}</strong>
            </div>
            {onCancel ? (
              <button
                className="plain-action"
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="approval-scroll">
            <div className="approval-copy">
              <p>{intro}</p>
              {reason ? <p>Reason: {reason}</p> : null}
              {detail ? <pre className="approval-command">{detail}</pre> : null}
            </div>

            {options.length > 0 ? (
              <div className="approval-options">
                {options.map((option, index) => (
                  <button
                    key={option.key}
                    type="button"
                    data-autofocus={index === 0 ? "true" : undefined}
                    className={`approval-option ${
                      index === selectedOptionIndex ? "selected" : ""
                    }`}
                    onClick={option.onSelect}
                  >
                    <span>{index === selectedOptionIndex ? "›" : " "}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {questions.length > 0 ? (
              <>
                <div className="question-stack">
                  {questions.map((question, questionIndex) => (
                    <div key={question.id} className="plain-question">
                      <strong>{question.header}</strong>
                      <div>{question.question}</div>
                      {question.options.length > 0 ? (
                        <div className="picker-inline-options">
                          {question.options.map((option, optionIndex) => (
                            <button
                              key={option}
                              type="button"
                              data-autofocus={
                                options.length === 0 &&
                                questionIndex === 0 &&
                                optionIndex === 0
                                  ? "true"
                                  : undefined
                              }
                              className={`picker-chip ${
                                question.value === option ? "selected" : ""
                              }`}
                              onClick={() => question.onChange(option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {question.allowsFreeform ? (
                        <input
                          className="surface-input"
                          data-autofocus={
                            options.length === 0 && questionIndex === 0
                              ? "true"
                              : undefined
                          }
                          value={question.value}
                          onChange={(event) => question.onChange(event.target.value)}
                          placeholder="Type an answer"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>

                {submitLabel && onSubmitQuestions ? (
                  <div className="approval-actions">
                    <button className="action-button" type="button" onClick={onSubmitQuestions}>
                      {submitLabel}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            <details className="advanced-json">
              <summary>Advanced response JSON</summary>
              <textarea
                className="raw-json-editor"
                value={requestDraft}
                onChange={(event) => onRequestDraftChange(event.target.value)}
              />
              <button className="plain-action" type="button" onClick={onSendJson}>
                Send JSON response
              </button>
            </details>
          </div>

          {footer ? <div className="surface-dialog-footer">{footer}</div> : null}
        </section>
      </div>
    );
  },
);
