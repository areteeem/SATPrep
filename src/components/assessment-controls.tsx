"use client";
import { useEffect } from "react";
import { MathJax } from "better-react-mathjax";
import { RotateCcw, Strikethrough } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const assessmentButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";
export function hasAssessmentContent(html?: string | null) {
  return Boolean(
    html &&
      (html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;|&#160;/g, " ")
        .trim() ||
        /<(img|svg|math|table)\b/i.test(html)),
  );
}
export function AssessmentActivePage({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("assessment-active");
    return () => document.body.classList.remove("assessment-active");
  }, [active]);
  return null;
}
export function AssessmentConfirm({
  open,
  title,
  description,
  confirmLabel = "Continue",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button className={assessmentButton} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`${assessmentButton} bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function AssessmentAnswerInput({
  value,
  onChange,
  disabled,
  checked,
  correct,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  checked?: boolean;
  correct?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <input
      aria-label="Your answer"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim() && !disabled) {
          e.preventDefault();
          onSubmit?.();
        }
      }}
      placeholder="Enter your answer"
      data-answer-state={
        checked ? (correct ? "correct" : "incorrect") : "unanswered"
      }
      className="assessment-answer-input w-full rounded-xl border border-neutral-300 bg-transparent p-3 text-base disabled:opacity-80 dark:border-neutral-700"
    />
  );
}
export function AssessmentAnswerOptions({
  options,
  selected,
  eliminated = {},
  onSelect,
  onEliminate,
  disabled = false,
  checked = false,
  correctAnswers = [],
}: {
  options: Record<string, string>;
  selected?: string | null;
  eliminated?: Record<string, boolean>;
  onSelect: (value: string | null) => void;
  onEliminate?: (value: string) => void;
  disabled?: boolean;
  checked?: boolean;
  correctAnswers?: string[] | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(options).map(([key, html], index) => {
        const label = String.fromCharCode(65 + index);
        const isCorrect =
          checked &&
          (correctAnswers || []).some(
            (answer) =>
              answer.trim().toLowerCase() === key.trim().toLowerCase(),
          );
        const isWrong = checked && selected === key && !isCorrect;
        return (
          <div key={key} className="assessment-option flex items-center gap-2">
            <button
              type="button"
              aria-pressed={selected === key}
              data-answer-state={
                isCorrect
                  ? "correct"
                  : isWrong
                    ? "incorrect"
                    : selected === key
                      ? "selected"
                      : "unanswered"
              }
              disabled={disabled || eliminated[key]}
              onClick={() => onSelect(key)}
              className={`assessment-answer flex min-h-14 flex-1 items-start gap-3 rounded-xl border border-neutral-300 bg-transparent p-3 text-left text-base dark:border-neutral-700 ${eliminated[key] ? "line-through opacity-50" : ""}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-current text-sm font-semibold">
                {label}
              </span>
              <MathJax inline dynamic>
                <span dangerouslySetInnerHTML={{ __html: html }} />
              </MathJax>
            </button>
            {onEliminate && (
              <button
                type="button"
                className="assessment-eliminate flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-300 dark:border-neutral-700"
                aria-label={`${eliminated[key] ? "Restore" : "Eliminate"} option ${label}`}
                aria-pressed={Boolean(eliminated[key])}
                disabled={disabled}
                onClick={() => {
                  if (!eliminated[key] && selected === key) onSelect(null);
                  onEliminate(key);
                }}
              >
                {eliminated[key] ? (
                  <RotateCcw size={20} />
                ) : (
                  <Strikethrough size={21} />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
