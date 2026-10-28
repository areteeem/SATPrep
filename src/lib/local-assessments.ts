import type {
  API_Response_Question,
  PlainQuestionType,
} from "@/types/question";
import type { PracticeSelections, PracticeSession } from "@/types/session";
import Fraction from "fraction.js";

export type LocalQuestion = {
  id: string;
  externalId: string;
  domain: string;
  skill?: string;
  answer: string;
  correctAnswers?: string[] | null;
  detail?: API_Response_Question;
};
export type LocalAssessment = {
  id: string;
  kind: "full" | "rush" | "custom";
  title: string;
  startedAt: string;
  updatedAt: string;
  status: string;
  questions: LocalQuestion[];
  fullTest?: unknown;
  selections?: PracticeSelections;
};
export const LOCAL_HISTORY_KEY = "sat-assessment-history-v1";
export function isCorrectAnswer(
  answer: string,
  correctAnswers?: string[] | null,
) {
  return Boolean(
    answer.trim() &&
      correctAnswers?.some((value) => {
        if (value.trim().toLowerCase() === answer.trim().toLowerCase())
          return true;
        try {
          return new Fraction(value).equals(new Fraction(answer));
        } catch {
          return false;
        }
      }),
  );
}
export function saveLocalAssessment(session: LocalAssessment) {
  const history = readStoredHistory();
  const index = history.findIndex((old) => old.id === session.id);
  if (index < 0) history.push(session);
  else history[index] = session;
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(-40)));
}
function readStoredHistory(): LocalAssessment[] {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter(
          (s) => s && typeof s.id === "string" && Array.isArray(s.questions),
        )
      : [];
  } catch {
    return [];
  }
}
export function fromLegacyRush(session: PracticeSession): LocalAssessment {
  const items = session.answeredQuestionDetails || [];
  return {
    id: session.sessionId,
    kind: "rush",
    title:
      session.name ||
      `${session.practiceSelections.assessment} ${session.practiceSelections.subject === "math" ? "Math" : "Reading & Writing"} Rush`,
    startedAt: session.timestamp,
    updatedAt: session.timestamp,
    status: session.status,
    selections: session.practiceSelections,
    questions: items.map((item) => ({
      id: item.questionId,
      externalId: item.externalId || item.ibn || "",
      domain:
        item.plainQuestion?.primary_class_cd ||
        session.practiceSelections.domains[0]?.primaryClassCd ||
        "",
      skill: item.plainQuestion?.skill_cd,
      answer: session.questionAnswers[item.questionId] || "",
      correctAnswers: session.questionCorrectChoices?.[item.questionId],
    })),
  };
}
export function readLocalAssessments(): LocalAssessment[] {
  const all = readStoredHistory();
  try {
    const rushes: PracticeSession[] = JSON.parse(
      localStorage.getItem("practiceHistory") || "[]",
    );
    const current = JSON.parse(
      localStorage.getItem("currentPracticeSession") || "null",
    );
    if (current?.sessionId) rushes.push(current);
    for (const session of rushes)
      if (session?.sessionId && !all.some((s) => s.id === session.sessionId))
        all.push(fromLegacyRush(session));
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("sat-full-test-v1")) continue;
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!saved?.modules?.length) continue;
      const id = saved.id || `legacy-${key}`;
      if (all.some((s) => s.id === id)) continue;
      all.push({
        id,
        kind: "full",
        title: "Full-Length Test",
        startedAt: saved.startedAt || "",
        updatedAt: saved.updatedAt || "",
        status: saved.stage === "done" ? "completed" : "saved",
        fullTest: { ...saved, id },
        questions: saved.modules
          .flat()
          .map((q: PlainQuestionType) => ({
            id: q.questionId,
            externalId: q.external_id || q.ibn || "",
            domain: q.primary_class_cd,
            skill: q.skill_cd,
            answer: saved.answers[q.questionId] || "",
            detail: saved.details[q.questionId],
            correctAnswers: saved.details[q.questionId]?.correct_answer,
          })),
      });
    }
  } catch {}
  return all.sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0),
  );
}
