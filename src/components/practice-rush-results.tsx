"use client";

import { AssessmentScoreReport } from "@/components/assessment-score-report";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
import type { PracticeSession } from "@/types/session";
import { playSound } from "@/lib/playSound";
import { PracticeResultsActions } from "@/components/practice-results-actions";

export default function PracticeRushResults({
  sessionData,
  questions,
  onContinue,
  resultToken,
}: {
  sessionData: PracticeSession;
  questions: WorkspaceQuestion[];
  onContinue: () => void;
  resultToken?: string;
}) {
  const section =
    sessionData.practiceSelections.subject === "math"
      ? "Math"
      : sessionData.practiceSelections.subject === "reading-writing"
        ? "Reading & Writing"
        : "Selected SAT sections";

  return (
    <AssessmentScoreReport
      title="Practice Rush results"
      questions={questions}
      subtitle={`${sessionData.practiceSelections.assessment} · ${section} · ${sessionData.answeredQuestions.length} answered`}
      reviewHref={`/review-session?local=${encodeURIComponent(sessionData.sessionId)}`}
      timeSpentMs={sessionData.totalTimeSpent}
      actions={
        <>
          <PracticeResultsActions
            title="Practice Rush results"
            sessionId={sessionData.sessionId}
            questions={questions}
            resultToken={resultToken}
          />
          <button
            type="button"
            onClick={() => {
              playSound("button-pressed.wav");
              onContinue();
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-neutral-300 px-5 py-3 font-medium text-neutral-800 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Start new practice
          </button>
        </>
      }
    />
  );
}
