"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, NotebookPen, Presentation } from "lucide-react";
import { FloatingToolWindow } from "@/components/floating-tool-window";
import { assessmentButton as button } from "@/components/assessment-controls";
import {
  openWhiteboard,
  readReviewMarks,
  setReviewMarks,
} from "@/lib/assessment-workspace";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
export function WhiteboardButton({
  questions,
  question,
  title = "Question whiteboard",
  showSolutions = false,
  label = "Whiteboard",
  boardKey,
}: {
  questions: WorkspaceQuestion[];
  question?: WorkspaceQuestion;
  title?: string;
  showSolutions?: boolean;
  label?: string;
  boardKey?: string;
}) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const marked = questions.filter((q) => q.marked);
  const openSet = (items: WorkspaceQuestion[], suffix: string) => {
    setError("");
    setOpen(false);
    void openWhiteboard(title, items, showSolutions, `${boardKey || title}:${suffix}`).catch(
      (e) => setError(e instanceof Error ? e.message : "Could not open the whiteboard."),
    );
  };
  return (
    <span ref={root} className="assessment-whiteboard-menu-root relative inline-flex flex-col gap-1">
      <button
        type="button"
        className={`${button} assessment-icon-button`}
        aria-label="Whiteboard options"
        title="Whiteboard options"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Presentation size={17} />
      </button>
      {open && (
        <div className="assessment-whiteboard-menu absolute right-0 top-full z-[220] mt-2 grid min-w-52 gap-1 rounded-xl border bg-white p-2 text-neutral-900 shadow-xl">
          {question && <button className="assessment-whiteboard-menu-item" onClick={() => openSet([question], "question")}>This question</button>}
          <button className="assessment-whiteboard-menu-item" disabled={!marked.length} onClick={() => openSet(marked, "marked")}>Marked questions{marked.length ? ` (${marked.length})` : ""}</button>
          <button className="assessment-whiteboard-menu-item" disabled={!questions.length} onClick={() => openSet(questions, "collection")}>Question collection{questions.length ? ` (${questions.length})` : ""}</button>
        </div>
      )}
      {error && (
        <span role="alert" className="text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
export function AssessmentWorkspaceActions({
  sessionId,
  question,
  questions,
  title = "Assessment",
  showSolutions = false,
  notes,
  onNotesChange,
  hideNotes = false,
  notesOnly = false,
}: {
  sessionId: string;
  question?: WorkspaceQuestion;
  questions: WorkspaceQuestion[];
  title?: string;
  showSolutions?: boolean;
  notes?: string;
  hideNotes?: boolean;
  notesOnly?: boolean;
  onNotesChange?: (value: string) => void;
}) {
  const [marks, setMarks] = useState<string[]>([]),
    [notesOpen, setNotesOpen] = useState(false),
    [localNote, setLocalNote] = useState("");
  const key = `sat-workspace-notes-v1:${sessionId}:${question?.id}`;
  useEffect(() => {
    const update = () => setMarks(readReviewMarks(sessionId));
    update();
    window.addEventListener("sat-review-marks", update);
    return () => window.removeEventListener("sat-review-marks", update);
  }, [sessionId]);
  useEffect(() => {
    try {
      setLocalNote(localStorage.getItem(key) || question?.notes || "");
    } catch {
      setLocalNote("");
    }
  }, [key, question?.notes]);
  const markedQuestions = questions.map((q) => ({ ...q, marked: marks.includes(q.id) }));
  const marked = question && marks.includes(question.id);
  return (
    <div className="assessment-workspace-actions flex flex-wrap items-center gap-2">
      {question && !notesOnly && (
        <>
          <button
            type="button"
            className={`${button} assessment-icon-button`}
            aria-pressed={Boolean(marked)}
            aria-label={marked ? "Remove review mark" : "Mark for review"}
            title={marked ? "Remove review mark" : "Mark for review"}
            onClick={() => {
              const next = marked
                ? marks.filter((id) => id !== question.id)
                : [...marks, question.id];
              setReviewMarks(sessionId, next);
              setMarks(next);
            }}
          >
            {marked ? <Check size={17} /> : <Bookmark size={17} />}
          </button>
          <WhiteboardButton
            question={question}
            questions={markedQuestions}
            title={`${title} · Question`}
            boardKey={`${sessionId}:${question.id}`}
            showSolutions={showSolutions}
          />
        </>
      )}
      {question && !hideNotes && (
        <>
          <button type="button" className={`${button} assessment-icon-button`} aria-label="Question notes" title="Question notes" onClick={() => setNotesOpen(true)}>
            <NotebookPen size={17} />
          </button>
          <FloatingToolWindow
            title="Question notes"
            open={notesOpen}
            onClose={() => setNotesOpen(false)}
            active
          >
            <label className="flex h-full flex-col gap-3 text-sm">
              Notes for this question
              <textarea
                className="min-h-60 flex-1 resize-none rounded-lg border bg-transparent p-3"
                placeholder="Write your working or teaching notes…"
                value={notes ?? localNote}
                onChange={(e) => {
                  if (onNotesChange) onNotesChange(e.target.value);
                  else {
                    setLocalNote(e.target.value);
                    try {
                      localStorage.setItem(key, e.target.value);
                    } catch {}
                  }
                }}
              />
            </label>
          </FloatingToolWindow>
        </>
      )}
    </div>
  );
}
export function AssessmentExplanation({
  html,
  questionId,
}: {
  html?: string | null;
  questionId: string;
}) {
  return (
    <details
      className="assessment-explanation col-span-full w-full rounded-xl border p-4"
      key={questionId}
    >
      <summary className="cursor-pointer font-semibold">Explanation</summary>
      <div className="pt-4">
        <ExplanationMarkup html={html} />
      </div>
    </details>
  );
}
import { MathJax } from "better-react-mathjax";
function ExplanationMarkup({ html }: { html?: string | null }) {
  return (
    <MathJax dynamic>
      <div
        dangerouslySetInnerHTML={{
          __html: html || "No explanation available.",
        }}
      />
    </MathJax>
  );
}
