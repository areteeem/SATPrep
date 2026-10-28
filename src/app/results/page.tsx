"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { satRequest } from "@/lib/satSharing";
import type { SharedResult } from "@/lib/satSharing";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
import { LocalAssessmentHistory } from "@/components/local-assessment-history";
import { AssessmentReview } from "@/components/assessment-review";
import { SendIndependentSatResult } from "@/components/send-independent-sat-result";
import { SendSatResult } from "@/components/send-sat-result";
export default function Results() {
  const [result, setResult] = useState<SharedResult | null>(null),
    [questions, setQuestions] = useState<WorkspaceQuestion[]>([]),
    [token, setToken] = useState(""),
    [assignmentToken, setAssignmentToken] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [assigned, setAssigned] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const local = new URLSearchParams(location.search).get("local");
    if (local) {
      location.replace(`/review-session?local=${encodeURIComponent(local)}`);
      return;
    }
    const raw = location.hash.slice(1);
    if (!raw) return;
    if (!/^[a-f0-9]{64}$/.test(raw)) {
      setError("This result link is invalid.");
      return;
    }
    setToken(raw);
    setAssignmentToken(
      sessionStorage.getItem(`sat-result-assignment:${raw}`) || "",
    );
    sessionStorage.setItem("sat-current-result", raw);
    history.replaceState(null, "", location.pathname);
    setLoading(true);
    void (async () => {
      try {
        const data = await satRequest<{
          result: SharedResult;
          isAssigned: boolean;
        }>("resolve_result", { token: raw });
        if (stopped) return;
        setResult(data.result);
        setAssigned(data.isAssigned);
        setQuestions(data.result.questions);
        for (let i = 0; i < data.result.questions.length; i += 6) {
          const batch = await Promise.all(
            data.result.questions.slice(i, i + 6).map(async (q) => {
              try {
                const response = await fetch(
                  `/api/question/${encodeURIComponent(q.externalId)}`,
                  { signal: controller.signal },
                );
                const payload = await response.json();
                return { ...q, detail: response.ok ? payload.data : undefined };
              } catch {
                return q;
              }
            }),
          );
          if (stopped) return;
          setQuestions((old) =>
            old.map((q) => batch.find((item) => item.id === q.id) || q),
          );
        }
      } catch (e) {
        if (!stopped)
          setError(e instanceof Error ? e.message : "Could not open result.");
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, []);
  if (result)
    return (
      <AssessmentReview
        sessionId={`shared-${token}`}
        title={
          result.mode === "full"
            ? "Full-length test results"
            : "Practice results"
        }
        questions={questions}
        loading={loading}
        actions={
          assigned ? (
            assignmentToken ? (
              <SendSatResult
                assignmentToken={assignmentToken}
                resultUrl={`${location.origin}/results#${token}`}
              />
            ) : (
              <p className="text-sm text-neutral-500">
                This result is connected to its assigning teacher.
              </p>
            )
          ) : (
            <SendIndependentSatResult token={token} />
          )
        }
      />
    );
  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-6 py-10">
      <Link href="/">← Home</Link>
      <h1 className="mt-8 text-3xl font-semibold">Results</h1>
      {error && (
        <p role="alert" className="mt-5">
          {error}
        </p>
      )}
      {loading && <p className="mt-5">Opening student result…</p>}
      <LocalAssessmentHistory />
    </main>
  );
}
