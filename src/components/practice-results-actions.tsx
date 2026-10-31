"use client";

import { useState } from "react";
import { Clipboard, FileDown, Presentation, Send } from "lucide-react";
import { isCorrectAnswer } from "@/lib/local-assessments";
import { practiceScore } from "@/lib/practice-score";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
import { openWhiteboard } from "@/lib/assessment-workspace";
import { assessmentButton as button } from "@/components/assessment-controls";
import { satRequest } from "@/lib/satSharing";
import { signInWithTutPro, tutproClient } from "@/lib/tutproAccount";
import { satResultDeliveryMessage } from "@/components/send-sat-result";

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
}: {
  resultToken: string;
  assignmentToken?: string;
}) {
  const [teachers, setTeachers] = useState<Array<{
    id: string;
    name: string;
  }> | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTeachers() {
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
  }

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

  if (!resultToken) return null;
  return (
    <div className="min-w-full space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Send size={16} /> Send results to Telegram
      </div>
      {!assignmentToken && teachers === null ? (
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => void loadTeachers()}
        >
          {busy ? "Checking linked accounts…" : "Choose linked teacher"}
        </button>
      ) : null}
      {!assignmentToken && teachers && teachers.length > 0 && (
        <select
          className={`${button} max-w-full`}
          aria-label="Linked Telegram teacher"
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
        >
          <option value="">Select a linked teacher</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={busy || (!assignmentToken && !teacherId)}
          onClick={() => void send("brief")}
        >
          Brief summary
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || (!assignmentToken && !teacherId)}
          onClick={() => void send("full")}
        >
          Full answers and correct answers
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="text-sm text-neutral-600 dark:text-neutral-400"
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function PracticeResultsActions({
  title,
  sessionId,
  questions,
  resultToken,
  assignmentToken,
}: {
  title: string;
  sessionId: string;
  questions: WorkspaceQuestion[];
  resultToken?: string;
  assignmentToken?: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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

  return (
    <div className="min-w-full space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={busy || !questions.length}
          onClick={() => void copy()}
        >
          <Clipboard size={16} /> Copy full practice
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || !questions.length}
          onClick={() => void exportPdf()}
        >
          <FileDown size={16} /> {busy ? "Preparing PDF…" : "Export full PDF"}
        </button>
        <button
          type="button"
          className={button}
          disabled={!questions.length}
          onClick={() => void board(false)}
        >
          <Presentation size={16} /> Export to whiteboard
        </button>
        <button
          type="button"
          className={button}
          disabled={!questions.length}
          onClick={() => void board(true)}
        >
          <Presentation size={16} /> All questions on one page
        </button>
      </div>
      {resultToken && (
        <AssessmentTelegramExport
          resultToken={resultToken}
          assignmentToken={assignmentToken}
        />
      )}
      {message && (
        <p
          role="status"
          className="text-sm text-neutral-600 dark:text-neutral-400"
        >
          {message}
        </p>
      )}
    </div>
  );
}
