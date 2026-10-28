import { isCorrectAnswer } from "@/lib/local-assessments";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
export function practiceScore(questions: WorkspaceQuestion[]) {
  const known = questions.filter(
    (q) => (q.detail?.correct_answer || q.correctAnswers)?.length,
  );
  const section = (math: boolean) => {
    const list = known.filter(
      (q) => ["H", "P", "Q", "S"].includes(q.domain) === math,
    );
    const correct = list.filter((q) =>
      isCorrectAnswer(q.answer, q.detail?.correct_answer || q.correctAnswers),
    ).length;
    return {
      total: list.length,
      correct,
      score: list.length
        ? Math.round((200 + (600 * correct) / list.length) / 10) * 10
        : null,
    };
  };
  const math = section(true),
    reading = section(false);
  const correct = math.correct + reading.correct;
  const score =
    known.length === questions.length && known.length
      ? math.score !== null && reading.score !== null
        ? math.score + reading.score
        : Math.round((400 + (1200 * correct) / known.length) / 10) * 10
      : null;
  return {
    score,
    correct,
    known: known.length,
    total: questions.length,
    answered: questions.filter((q) => q.answer?.trim()).length,
    math,
    reading,
    projected: !math.total || !reading.total,
  };
}
