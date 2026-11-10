"use client";
import { useEffect, useState } from "react";
import type { PracticeSession } from "@/types/session";
import type { ResultQuestion } from "@/lib/satSharing";
import { readLocalAssessments, fromLegacyRush } from "@/lib/local-assessments";
import {
  AssessmentCompletion,
  SendLocalResult,
} from "@/components/assessment-completion";
export function ShareRushResult({
  session,
  onResultReady,
}: {
  session: PracticeSession;
  onResultReady?: (url: string) => void;
}) {
  const [questions, setQuestions] = useState<ResultQuestion[]>([]);
  useEffect(() => {
    const saved =
      readLocalAssessments().find((item) => item.id === session.sessionId) ||
      fromLegacyRush(session);
    setQuestions(
      saved.questions.map(({ id, externalId, domain, answer }) => ({
        id,
        externalId,
        domain,
        answer,
      })),
    );
  }, [session]);
  if (!questions.length) return null;
  if (session.status === "completed")
    return (
      <AssessmentCompletion
        redirect={false}
        showStatus={false}
        localId={session.sessionId}
        result={{ mode: "rush", questions }}
        onResultReady={onResultReady}
      />
    );
  return (
    <div className="mx-auto max-w-xl p-5">
      <SendLocalResult result={{ mode: "rush", questions }} />
    </div>
  );
}
