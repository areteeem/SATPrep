"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpenCheck,
  BookOpen,
  ArrowRight,
  Clipboard,
  Copy,
  FileDown,
  MessageCircle,
  Presentation,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import { isCorrectAnswer } from "@/lib/local-assessments";
import { practiceScore } from "@/lib/practice-score";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
import { openWhiteboard } from "@/lib/assessment-workspace";
import { assessmentButton as button } from "@/components/assessment-controls";
import { satRequest } from "@/lib/satSharing";
import { signInWithTutPro, tutproClient } from "@/lib/tutproAccount";
import { satResultDeliveryMessage } from "@/components/send-sat-result";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function plainText(html?: string | null) {
  if (!html) return "";
  const node = document.createElement("div");
  node.innerHTML = html;
  node.querySelectorAll("script,style").forEach((item) => item.remove());
  return (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
}

export function formatPracticeResults(
  title: string,
  questions: WorkspaceQuestion[],
) {
  const estimate = practiceScore(questions);
  const available = questions.filter(
    (question) =>
      (question.detail?.correct_answer || question.correctAnswers)?.length,
  );
  const correctCount = available.filter((question) =>
    isCorrectAnswer(
      question.answer,
      question.detail?.correct_answer || question.correctAnswers,
    ),
  ).length;
  const answered = questions.filter((question) =>
    question.answer?.trim(),
  ).length;
  const lines = [
    title,
    `Estimated SAT score: ${estimate.score ?? "Unavailable"}${estimate.score === null ? "" : "/1600 (unofficial)"}`,
    `Correct: ${correctCount}/${available.length} · Incorrect: ${available.length - correctCount} · Unanswered: ${questions.length - answered} · Answered: ${answered}`,
    "",
  ];

  questions.forEach((question, index) => {
    const detail = question.detail;
    const keys = detail?.correct_answer || question.correctAnswers || [];
    const answerOptions = Object.entries(detail?.answerOptions || {});
    const outcome = !question.answer?.trim()
      ? "UNANSWERED"
      : !keys.length
        ? "ANSWER KEY UNAVAILABLE"
        : isCorrectAnswer(question.answer, keys)
          ? "CORRECT"
          : "INCORRECT";
    lines.push(
      `Question ${index + 1} · ${question.module || question.domain || "SAT"}${question.skill ? ` · ${question.skill}` : ""}`,
      plainText(detail?.stimulus)
        ? `Passage: ${plainText(detail?.stimulus)}`
        : "",
      `Prompt: ${plainText(detail?.stem) || "Question text unavailable"}`,
      ...answerOptions.map(([key, value]) => `${key}. ${plainText(value)}`),
      `Your answer: ${question.answer?.trim() || "Unanswered"}`,
      `Correct answer: ${keys.length ? keys.join(", ") : "Unavailable"}`,
      `Result: ${outcome}`,
      detail?.rationale ? `Explanation: ${plainText(detail.rationale)}` : "",
      "",
    );
  });
  return lines
    .filter((line, index) => line || (index > 0 && lines[index - 1]))
    .join("\n");
}

export function AssessmentTelegramExport({
  resultToken,
  assignmentToken,
  open,
  onOpenChange,
}: {
  resultToken: string;
  assignmentToken?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [teachers, setTeachers] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [teacherLookupStarted, setTeacherLookupStarted] = useState(false);

  const loadTeachers = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const user = (await tutproClient?.auth.getUser())?.data.user;
      if (!user) {
        signInWithTutPro(`/results#${resultToken}`);
        return;
      }
      await satRequest("claim_result", { resultToken }, true);
      const response = await satRequest<{
        teachers: Array<{ id: string; name: string }>;
      }>("list_teachers", {}, true);
      setTeachers(response.teachers);
      if (!response.teachers.length)
        setMessage(
          "No linked teacher with Telegram is available for your TutPro account.",
        );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not find a linked Telegram account.",
      );
    } finally {
      setBusy(false);
    }
  }, [resultToken]);

  useEffect(() => {
    if (
      open &&
      !assignmentToken &&
      teachers === null &&
      !busy &&
      !teacherLookupStarted
    ) {
      setTeacherLookupStarted(true);
      void loadTeachers();
    }
  }, [open, assignmentToken, teachers, busy, teacherLookupStarted, loadTeachers]);

  async function send(format: "brief" | "full") {
    if (!assignmentToken && !teacherId) {
      setMessage("Choose a linked teacher first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await satRequest<{ status: string; reason?: string }>(
        "notify_teacher",
        {
          resultToken,
          format,
          ...(assignmentToken ? { assignmentToken } : { teacherId }),
        },
        !assignmentToken,
      );
      setMessage(satResultDeliveryMessage(response.status, response.reason));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not queue Telegram delivery.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="assessment-modal assessment-modal--compact gap-5">
        <DialogHeader>
          <DialogTitle className="assessment-modal-title">
            Send results to Telegram
          </DialogTitle>
          <DialogDescription className="assessment-modal-copy">
            {assignmentToken
              ? "Send a score summary or include the questions, your answers, and the answer key."
              : "Choose a linked teacher, then send a score summary or the full questions, your answers, and answer key."}
          </DialogDescription>
        </DialogHeader>
        {!assignmentToken && (
          <div className="space-y-2">
            <label
              htmlFor="assessment-telegram-teacher"
              className="text-sm font-medium"
            >
              Linked teacher
            </label>
            <select
              id="assessment-telegram-teacher"
              className={`${button} w-full justify-start`}
              value={teacherId}
              disabled={busy || !teachers?.length}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <option value="">
                {busy ? "Finding linked teachers…" : "Select a teacher"}
              </option>
              {teachers?.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            {teachers === null && !busy && message && (
              <button
                type="button"
                className="text-sm font-medium underline underline-offset-4"
                onClick={() => void loadTeachers()}
              >
                Try finding linked teachers again
              </button>
            )}
          </div>
        )}
        {message && (
          <p
            role="status"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {message}
          </p>
        )}
        <DialogFooter className="gap-2 sm:space-x-0">
          <button
            type="button"
            className="assessment-modal-button assessment-modal-button--secondary flex-1"
            disabled={busy || (!assignmentToken && !teacherId)}
            onClick={() => void send("brief")}
          >
            <MessageCircle size={17} /> Brief summary
          </button>
          <button
            type="button"
            className="assessment-modal-button assessment-modal-button--primary flex-1"
            disabled={busy || (!assignmentToken && !teacherId)}
            onClick={() => void send("full")}
          >
            <FileDown size={17} /> Full answers + key
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PracticeResultsActions({
  title,
  sessionId,
  questions,
  resultToken,
  assignmentToken,
  loading = false,
  compact = false,
  onPracticeMistakes,
  onStartOver,
}: {
  title: string;
  sessionId: string;
  questions: WorkspaceQuestion[];
  resultToken?: string;
  assignmentToken?: string;
  loading?: boolean;
  compact?: boolean;
  onPracticeMistakes?: (includeSimilar: boolean) => void;
  onStartOver?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const text = () => formatPracticeResults(title, questions);

  async function exportPdf() {
    setBusy(true);
    setMessage("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 42;
      const width = pdf.internal.pageSize.getWidth() - margin * 2;
      let y = margin;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      for (const paragraph of text().split("\n")) {
        const wrapped = pdf.splitTextToSize(paragraph || " ", width);
        const isHeading = /^Question \d+/.test(paragraph);
        if (isHeading) pdf.setFont("helvetica", "bold");
        if (isHeading && y > margin) y += 5;
        const lineHeight = isHeading ? 15 : 13;
        if (
          y + wrapped.length * lineHeight >
          pdf.internal.pageSize.getHeight() - margin
        ) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(wrapped, margin, y);
        y += wrapped.length * lineHeight;
        if (isHeading) pdf.setFont("helvetica", "normal");
      }
      pdf.save(`${title.replace(/[^a-z0-9]+/gi, "-")}-full-results.pdf`);
      setMessage("Full practice PDF downloaded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create the PDF.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      setMessage("Full practice, your answers, and answer keys copied.");
    } catch {
      setMessage("Clipboard access was denied by the browser.");
    }
  }

  async function copyResultLink() {
    if (!resultToken) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/results#${resultToken}`,
      );
      setMessage("Shared results link copied. Anyone with the link can view these results.");
    } catch {
      setMessage("Clipboard access was denied. You can open the result and copy its URL.");
    }
  }

  function openSharedResult() {
    if (!resultToken) return;
    sessionStorage.setItem("sat-current-result", resultToken);
    if (assignmentToken)
      sessionStorage.setItem(
        `sat-result-assignment:${resultToken}`,
        assignmentToken,
      );
    window.location.href = `/results#${resultToken}`;
  }

  async function board(singlePage: boolean) {
    setMessage("");
    try {
      await openWhiteboard(
        `${title} · ${singlePage ? "All questions" : "Review"}`,
        questions,
        true,
        `result-export:${sessionId}:${singlePage ? "single-page" : "question-pages"}`,
        singlePage,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not open the whiteboard.",
      );
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${button} inline-flex items-center gap-2 px-3`}
              disabled={loading || !questions.length}
              aria-label="Export practice"
              title="Export practice"
            >
              <FileDown size={16} />
              <span>Export</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className="w-64"
          >
            <DropdownMenuLabel>Export this practice</DropdownMenuLabel>
            <DropdownMenuItem disabled={loading} onSelect={() => void copy()}>
              <Clipboard /> Copy full practice
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loading || busy}
              onSelect={() => void exportPdf()}
            >
              <FileDown /> Download full PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loading}
              onSelect={() => void board(false)}
            >
              <Presentation /> Export to whiteboard
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loading}
              onSelect={() => void board(true)}
            >
              <Presentation /> All questions on one page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {message && (
          <span
            role="status"
            className="max-w-48 truncate text-xs text-neutral-500"
          >
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-full space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={`${button} min-h-12 w-full sm:w-auto`}>
              <Share2 size={18} aria-hidden="true" /> Share
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="w-[min(20rem,calc(100vw-1.5rem))]"
          >
            <DropdownMenuLabel>Share these results</DropdownMenuLabel>
            {resultToken ? (
              <>
                <DropdownMenuItem
                  className="min-h-14 py-3"
                  onSelect={() => void copyResultLink()}
                >
                  <Copy aria-hidden="true" />
                  <span className="flex flex-col">
                    <span>Copy shared result link</span>
                    <span className="text-xs text-muted-foreground">
                      Share a view-only results page
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openSharedResult}>
                  <ArrowRight aria-hidden="true" /> View shared result
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled>
                <Copy aria-hidden="true" /> Preparing shared result link…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!resultToken}
              onSelect={() => setTelegramOpen(true)}
            >
              <Send aria-hidden="true" /> Send to teacher on Telegram
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${button} min-h-12 w-full sm:w-auto`}
              disabled={loading || !questions.length}
            >
              <FileDown size={18} aria-hidden="true" /> Export
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="w-64"
          >
            <DropdownMenuLabel>Export full practice</DropdownMenuLabel>
            <DropdownMenuItem disabled={loading} onSelect={() => void copy()}>
              <Clipboard aria-hidden="true" /> Copy questions and answers
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loading || busy}
              onSelect={() => void exportPdf()}
            >
              <FileDown aria-hidden="true" /> Download practice PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={loading}
              onSelect={() => void board(false)}
            >
              <Presentation aria-hidden="true" /> Export to whiteboard
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={loading}
              onSelect={() => void board(true)}
            >
              <Presentation aria-hidden="true" /> All questions on one page
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`${button} min-h-12 w-full sm:w-auto`}
              disabled={loading || !sessionId}
            >
              <BookOpenCheck size={18} aria-hidden="true" /> Practice mistakes
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="w-64"
          >
            <DropdownMenuLabel>Choose a practice set</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                onPracticeMistakes
                  ? onPracticeMistakes(false)
                  : (window.location.href = `/results?local=${encodeURIComponent(sessionId)}&practice=mistakes`)
              }
            >
              <BookOpen aria-hidden="true" />
              Missed questions only
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onPracticeMistakes
                  ? onPracticeMistakes(true)
                  : (window.location.href = `/results?local=${encodeURIComponent(sessionId)}&practice=mistakes&similar=1`)
              }
            >
              <Sparkles aria-hidden="true" />
              <span className="flex flex-col">
                <span>Missed + similar questions</span>
                <span className="text-xs text-muted-foreground">
                  Matched to the same SAT skills
                </span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          className={`${button} min-h-12 w-full sm:w-auto`}
          disabled={!onStartOver}
          onClick={onStartOver}
        >
          <RotateCcw size={18} aria-hidden="true" /> Start over
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
        >
          {message}
        </p>
      )}
      {resultToken && (
        <AssessmentTelegramExport
          resultToken={resultToken}
          assignmentToken={assignmentToken}
          open={telegramOpen}
          onOpenChange={setTelegramOpen}
        />
      )}
    </div>
  );
}
