"use client";
import { useEffect, useState } from "react";
import { AssessmentReview } from "@/components/assessment-review";
import { SendLocalResult } from "@/components/assessment-completion";
import { readLocalAssessments } from "@/lib/local-assessments";
import { readReviewMarks } from "@/lib/assessment-workspace";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
export default function ReviewSession() {
  const [questions, setQuestions] = useState<WorkspaceQuestion[]>([]),
    [title, setTitle] = useState("Saved assessment"),
    [id, setId] = useState(""),
    [mode, setMode] = useState<"full" | "rush" | "custom">("rush"),
    [assignment, setAssignment] = useState(""),
    [initialQuestion, setInitialQuestion] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      const key = new URLSearchParams(location.search).get("local");
      setInitialQuestion(new URLSearchParams(location.search).get("question") || "");
      const session = readLocalAssessments().find((s) => s.id === key);
      if (!session) {
        setError("This session is not saved on this device.");
        setLoading(false);
        return;
      }
      setId(session.id);
      setTitle(session.title);
      setMode(session.kind);
      setAssignment(
        session.assignmentToken ||
          (session.fullTest as { assignmentToken?: string })?.assignmentToken ||
          "",
      );
      const marks = readReviewMarks(session.id);
      const modules = (
        session.fullTest as { modules?: { questionId: string }[][] }
      )?.modules;
      const items = session.questions.map((q) => ({
        ...q,
        marked: marks.includes(q.id),
        module: modules
          ? [
              "Reading & Writing · Module 1",
              "Reading & Writing · Module 2",
              "Math · Module 1",
              "Math · Module 2",
            ][modules.findIndex((m) => m.some((i) => i.questionId === q.id))]
          : undefined,
      }));
      setQuestions(items);
      for (let start = 0; start < items.length; start += 6) {
        const batch = await Promise.all(
          items.slice(start, start + 6).map(async (q) => {
            if (q.detail || !q.externalId) return q;
            try {
              const response = await fetch(
                `/api/question/${encodeURIComponent(q.externalId)}`,
                { signal: controller.signal },
              );
              const payload = await response.json();
              return { ...q, detail: payload.data };
            } catch {
              return q;
            }
          }),
        );
        if (!alive) return;
        setQuestions((old) =>
          old.map((q) => batch.find((x) => x.id === q.id) || q),
        );
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);
  return error ? (
    <main className="p-8" role="alert">
      {error}
    </main>
  ) : (
    <AssessmentReview
      sessionId={id}
      title={title}
      questions={questions}
      initialQuestionId={initialQuestion}
      loading={loading}
      actions={
        <SendLocalResult
          result={{
            mode,
            questions: questions.map((q) => ({
              id: q.id,
              externalId: q.externalId,
              domain: q.domain,
              answer: q.answer,
            })),
          }}
          assignmentToken={assignment}
        />
      }
    />
  );
}
