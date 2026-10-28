"use client";
import { useEffect, useState } from "react";
import type { PracticeSession } from "@/types/session";
import type { ResultQuestion } from "@/lib/satSharing";
import { readLocalAssessments, fromLegacyRush } from "@/lib/local-assessments";
import {
  AssessmentCompletion,
  SendLocalResult,
} from "@/components/assessment-completion";
export function ShareRushResult({ session }: { session: PracticeSession }) {
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
  return questions.length ? (
    <div className="mx-auto max-w-xl p-5">
      {session.status === "completed" ? (
        <AssessmentCompletion
          localId={session.sessionId}
          result={{ mode: "rush", questions }}
        />
      ) : (
        <SendLocalResult result={{ mode: "rush", questions }} />
      )}
    </div>
  ) : null;
}
