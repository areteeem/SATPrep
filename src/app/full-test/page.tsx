"use client";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { MathJax } from "better-react-mathjax";
import {
  AssessmentWorkspaceActions,
  AssessmentExplanation,
} from "@/components/assessment-workspace-actions";
import { AssessmentCompletion } from "@/components/assessment-completion";
import { practiceScore } from "@/lib/practice-score";
import { fillQuestionBlank } from "@/lib/assessment-blanks";
import { Save } from "lucide-react";
import {
  AssessmentCalculatorTools,
  AssessmentMathPanel,
} from "@/components/assessment-calculator-tools";
import {
  AssessmentActivePage,
  AssessmentAnswerInput,
  AssessmentAnswerOptions,
  AssessmentConfirm,
  assessmentButton as button,
  hasAssessmentContent,
} from "@/components/assessment-controls";
import { satRequest } from "@/lib/satSharing";
import {
  isCorrectAnswer,
  readLocalAssessments,
  saveLocalAssessment,
} from "@/lib/local-assessments";
import { SendSatResult } from "@/components/send-sat-result";
import { AnnotatedPassage } from "@/components/annotated-passage";
import type {
  PlainQuestionType as Item,
  API_Response_Question as Detail,
} from "@/types/question";

type Stage = "ready" | "rw1" | "rw2" | "break" | "math1" | "math2" | "done";
type Saved = {
  assignmentToken?: string;
  id?: string;
  startedAt?: string;
  stage: Stage;
  banks: Item[][];
  modules: Item[][];
  index: number;
  answers: Record<string, string>;
  details: Record<string, Detail>;
  deadline: number;
  eliminated: Record<string, string[]>;
  notes: Record<string, string>;
  paused?: boolean;
  remaining?: number;
};
const KEY = "sat-full-test-v1";
const names: Record<string, string> = {
  INI: "Information and Ideas",
  CAS: "Craft and Structure",
  EOI: "Expression of Ideas",
  SEC: "Standard English Conventions",
  H: "Algebra",
  P: "Advanced Math",
  Q: "Problem-Solving and Data Analysis",
  S: "Geometry and Trigonometry",
};
const rw = { INI: 7, CAS: 8, EOI: 5, SEC: 7 },
  rwFirst = { INI: 7, CAS: 7, EOI: 6, SEC: 7 },
  math = { H: 7, P: 8, Q: 3, S: 4 },
  mathFirst = { H: 8, P: 7, Q: 4, S: 3 };
const empty: Saved = {
  stage: "ready",
  banks: [],
  modules: [],
  index: 0,
  answers: {},
  details: {},
  deadline: 0,
  eliminated: {},
  notes: {},
};
const moduleIndex = (stage: Stage) =>
  (({ rw1: 0, rw2: 1, math1: 2, math2: 3 }) as Record<string, number>)[stage] ??
  0;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function pick(pool: Item[], counts: Record<string, number>, used: Set<string>) {
  return shuffled(
    Object.entries(counts).flatMap(([domain, count]) => {
      const eligible = pool.filter(
        (q) =>
          q.primary_class_cd === domain &&
          !used.has(q.questionId) &&
          (q.external_id || q.ibn) &&
          q.difficulty !== "E",
      );
      const hard = shuffled(eligible.filter((q) => q.difficulty === "H")),
        medium = shuffled(eligible.filter((q) => q.difficulty === "M"));
      const selected: Item[] = [];
      let mediumCount = 0;
      const mediumLimit = Math.max(1, Math.floor(count * 0.2));
      for (let i = 0; i < count; i++) {
        const useMedium =
          mediumCount < mediumLimit &&
          medium.length > 0 &&
          (Math.random() < 0.1 || !hard.length);
        const next = useMedium ? medium.pop() : hard.pop();
        if (!next)
          throw new Error(
            `Not enough hard questions in ${names[domain]}. Try again when more questions are available.`,
          );
        if (useMedium) mediumCount++;
        selected.push(next);
        used.add(next.questionId);
      }
      return selected;
    }),
  );
}
function Countdown({
  deadline,
  children,
}: {
  deadline: number;
  children: (seconds: number) => ReactNode;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return children(Math.max(0, Math.ceil((deadline - now) / 1000)));
}
export default function FullTest() {
  const [session, setSession] = useState<Saved>(empty),
    [hydrated, setHydrated] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState(false),
    [reviewModule, setReviewModule] = useState(0),
    [retry, setRetry] = useState(0),
    [assignmentToken, setAssignmentToken] = useState(""),
    [storageKey, setStorageKey] = useState(KEY),
    [shareUrl, setShareUrl] = useState(""),
    [confirmation, setConfirmation] = useState<"finish" | "restart" | null>(
      null,
    );
  useEffect(() => {
    try {
      const query = new URLSearchParams(location.search),
        assigned = query.get("assigned") === "1",
        token = assigned
          ? sessionStorage.getItem("sat-assignment-token") || ""
          : "";
      if (assigned && !token) {
        setError("The assignment link is missing. Open the link again.");
        return;
      }
      const storage = token ? `${KEY}:${token}` : KEY;
      setAssignmentToken(token);
      setStorageKey(storage);
      const resume = query.get("resume");
      const historical = resume
        ? readLocalAssessments().find((s) => s.id === resume)?.fullTest
        : undefined;
      const saved =
        historical || JSON.parse(localStorage.getItem(storage) || "null");
      if (saved) {
        const restored = saved as Saved;
        setSession(
          resume && restored.paused
            ? {
                ...restored,
                paused: false,
                deadline: Date.now() + (restored.remaining || 0),
              }
            : restored,
        );
        if ((saved as Saved).assignmentToken) {
          setAssignmentToken((saved as Saved).assignmentToken!);
          setStorageKey(`${KEY}:${(saved as Saved).assignmentToken}`);
        }
      }
    } catch {
      setError("Saved progress could not be opened.");
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(session));
      if (session.id)
        saveLocalAssessment({
          id: session.id,
          kind: "full",
          title: "Full-Length Test",
          startedAt: session.startedAt || "",
          updatedAt: new Date().toISOString(),
          status:
            session.stage === "done"
              ? "completed"
              : session.paused
                ? "saved"
                : "in_progress",
          fullTest: session,
          questions: session.modules.flat().map((q) => ({
            id: q.questionId,
            externalId: q.external_id || q.ibn || "",
            domain: q.primary_class_cd,
            skill: q.skill_cd,
            answer: session.answers[q.questionId] || "",
            detail: session.details[q.questionId],
            correctAnswers: session.details[q.questionId]?.correct_answer,
          })),
        });
    } catch {
      setError(
        "Unable to save progress on this device. Check browser storage before continuing.",
      );
    }
  }, [session, hydrated, storageKey]);
  const stage = session.stage,
    active = ["rw1", "rw2", "math1", "math2"].includes(stage);
  const module =
      session.modules[stage === "done" ? reviewModule : moduleIndex(stage)] ||
      [],
    item = module[session.index],
    detail = item && session.details[item.questionId];
  const isMath = item && !Object.keys(rw).includes(item.primary_class_cd),
    hasStimulus = hasAssessmentContent(detail?.stimulus),
    showMathPanel = Boolean(isMath && !hasStimulus);
  useEffect(() => {
    if (!item || detail) return;
    const controller = new AbortController();
    setError("");
    fetch(
      `/api/question/${encodeURIComponent(item.external_id || item.ibn || "")}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.data)
          throw new Error(
            "Could not load this question. Check your connection and try again.",
          );
        setSession((old) => ({
          ...old,
          details: { ...old.details, [item.questionId]: data.data },
        }));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [item, detail, retry]);
  const advance = useCallback(
    () =>
      setSession((old) => {
        if (!["rw1", "rw2", "math1", "math2"].includes(old.stage)) return old;
        if (old.stage === "rw2")
          return {
            ...old,
            stage: "break",
            index: 0,
            deadline: Date.now() + 600000,
          };
        if (old.stage === "math2")
          return { ...old, stage: "done", index: 0, deadline: 0 };
        const index = moduleIndex(old.stage),
          next = old.stage === "rw1" ? "rw2" : "math2",
          modules = [...old.modules];
        modules[index + 1] = old.banks[old.stage === "rw1" ? 0 : 2];
        return {
          ...old,
          modules,
          stage: next,
          index: 0,
          deadline: Date.now() + (next === "rw2" ? 32 : 35) * 60000,
        };
      }),
    [],
  );
  useEffect(() => {
    if (!active || session.paused || !session.deadline) return;
    const id = setTimeout(
      advance,
      Math.max(0, session.deadline - Date.now()) + 20,
    );
    return () => clearTimeout(id);
  }, [active, session.deadline, session.paused, advance]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const pools = await Promise.all(
        ["INI,CAS,EOI,SEC", "H,P,Q,S"].map((domains) =>
          fetch(`/api/get-questions?assessment=SAT&domains=${domains}`).then(
            async (response) => {
              const data = await response.json();
              if (!response.ok || !data.success)
                throw new Error(data.error || "Question bank unavailable.");
              return data.data as Item[];
            },
          ),
        ),
      );
      const used = new Set<string>();
      const firstRW = pick(pools[0], rwFirst, used),
        secondRW = pick(pools[0], rw, used),
        firstMath = pick(pools[1], mathFirst, used),
        secondMath = pick(pools[1], math, used);
      setSession({
        ...empty,
        assignmentToken: assignmentToken || undefined,
        id: `full-${Date.now()}`,
        startedAt: new Date().toISOString(),
        stage: "rw1",
        banks: [secondRW, secondRW, secondMath, secondMath],
        modules: [firstRW, secondRW, firstMath, secondMath],
        deadline: Date.now() + 32 * 60000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare test.");
    } finally {
      setBusy(false);
    }
  }
  async function shareResult() {
    setBusy(true);
    setError("");
    try {
      const result = {
        mode: "full",
        questions: session.modules.flat().map((q) => ({
          id: q.questionId,
          externalId: q.external_id || q.ibn || "",
          domain: q.primary_class_cd,
          answer: session.answers[q.questionId] || "",
        })),
      };
      const data = await satRequest<{ url: string }>("create_result", {
        result,
        ...(assignmentToken ? { assignmentToken } : {}),
      });
      setShareUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not share result.");
    } finally {
      setBusy(false);
    }
  }
  const beginMath = () =>
    setSession((old) => ({
      ...old,
      stage: "math1",
      index: 0,
      deadline: Date.now() + 35 * 60000,
    }));
  const setAnswer = (value: string | null) =>
    item &&
    setSession((old) => ({
      ...old,
      answers: { ...old.answers, [item.questionId]: value || "" },
    }));
  const all = session.modules.flat(),
    points = all.filter((q) =>
      isCorrectAnswer(
        session.answers[q.questionId] || "",
        session.details[q.questionId]?.correct_answer,
      ),
    ).length;
  const workspaceQuestions = session.modules.flatMap((mod, m) =>
    mod.map((q) => ({
      id: q.questionId,
      externalId: q.external_id || q.ibn || "",
      domain: q.primary_class_cd,
      answer: session.answers[q.questionId] || "",
      detail: session.details[q.questionId],
      module: [
        "Reading & Writing · Module 1",
        "Reading & Writing · Module 2",
        "Math · Module 1",
        "Math · Module 2",
      ][m],
      notes: session.notes[q.questionId],
    })),
  );
  const estimated = practiceScore(workspaceQuestions);
  return (
    <main
      className="assessment-full-page min-h-dvh bg-background px-5 py-6 text-foreground"
      data-assessment-content
    >
      <AssessmentActivePage active={active || stage === "break"} />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-5 dark:border-neutral-700">
          <Link href="/results" className="font-semibold">
            ← Practice sessions
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {stage === "done" && review && (
              <select
                aria-label="Review module"
                className={`${button} review-section-select`}
                value={reviewModule}
                onChange={(e) => {
                  setReviewModule(Number(e.target.value));
                  setSession((old) => ({ ...old, index: 0 }));
                }}
              >
                {[
                  "Reading and Writing 1",
                  "Reading and Writing 2",
                  "Math 1",
                  "Math 2",
                ].map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            {(active || stage === "break") && !session.paused && (
              <Countdown deadline={session.deadline}>
                {(seconds) => (
                  <span
                    aria-label="Time remaining"
                    className="font-mono text-lg"
                  >
                    {clock(seconds)}
                  </span>
                )}
              </Countdown>
            )}
            {active && isMath && hasStimulus && !session.paused && (
              <AssessmentCalculatorTools />
            )}
            {(active || stage === "break") && !session.paused && (
              <button
                className={button}
                onClick={() =>
                  setSession((old) => ({
                    ...old,
                    paused: true,
                    remaining: Math.max(0, old.deadline - Date.now()),
                  }))
                }
              >
                <Save size={16} />
                Save for later
              </button>
            )}
          </div>
        </header>
        {error && (
          <p role="alert" className="my-5 rounded-xl border border-red-300 p-4">
            {error}{" "}
            <button
              className="underline"
              onClick={() => {
                setError("");
                setRetry((n) => n + 1);
              }}
            >
              Retry
            </button>
          </p>
        )}
        {stage === "ready" && (
          <section className="mx-auto max-w-2xl py-16">
            <p className="text-sm uppercase tracking-widest text-neutral-500">
              Unofficial practice
            </p>
            <h1 className="mt-3 text-4xl font-semibold">Full-Length Test</h1>
            <p className="mt-5 leading-7 text-neutral-600 dark:text-neutral-400">
              98 questions in four timed modules: Reading and Writing (27
              questions, 32 minutes each) and Math (22 questions, 35 minutes
              each), with a skippable 10-minute break. Questions are mostly
              hard, with occasional medium questions and no easy questions. Your
              work is saved on this device. Results are not official SAT scores.
            </p>
            <button
              onClick={start}
              disabled={busy || !hydrated}
              className={`${button} mt-8 bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950`}
            >
              {busy ? "Preparing questions…" : "Start test"}
            </button>
          </section>
        )}
        {session.paused && (
          <section className="mx-auto max-w-xl py-20 text-center">
            <h1 className="text-3xl font-semibold">Test saved for later</h1>
            <p className="mt-4 text-neutral-500">
              Your answers and{" "}
              {clock(Math.ceil((session.remaining || 0) / 1000))} remaining are
              saved on this device.
            </p>
            <button
              className={`${button} mt-6`}
              onClick={() =>
                setSession((old) => ({
                  ...old,
                  paused: false,
                  deadline: Date.now() + (old.remaining || 0),
                }))
              }
            >
              Resume test
            </button>
            <Link href="/results" className={`${button} ml-3 mt-6`}>
              View saved sessions
            </Link>
          </section>
        )}
        {stage === "break" && !session.paused && (
          <section className="py-20 text-center">
            <h1 className="text-3xl font-semibold">Break</h1>
            <p className="mt-4">
              Reading and Writing is complete. Math begins after the break.
            </p>
            <Countdown deadline={session.deadline}>
              {(seconds) => (
                <div className="mt-8 flex justify-center gap-3">
                  <button
                    className={button}
                    disabled={seconds > 0}
                    onClick={beginMath}
                  >
                    Begin Math {seconds > 0 ? `in ${clock(seconds)}` : ""}
                  </button>
                  <button className={button} onClick={beginMath}>
                    Skip break
                  </button>
                </div>
              )}
            </Countdown>
          </section>
        )}
        {stage === "done" && !review && (
          <section className="py-16">
            <h1 className="text-3xl font-semibold">Practice complete</h1>
            <AssessmentCompletion
              localId={session.id || ""}
              assignmentToken={assignmentToken}
              result={{
                mode: "full",
                questions: workspaceQuestions.map(
                  ({ id, externalId, domain, answer }) => ({
                    id,
                    externalId,
                    domain,
                    answer,
                  }),
                ),
              }}
            />
            {estimated.score !== null && (
              <p className="mt-3 text-xl">
                Estimated practice score: {estimated.score}/1600
              </p>
            )}
            <p className="mt-4 text-xl">
              {points} correct out of {all.length}
            </p>
            <p className="mt-2 text-neutral-500">
              Unofficial practice result. This is not an SAT score.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {Object.entries(names).map(([key, name]) => {
                const questions = all.filter((q) => q.primary_class_cd === key);
                return (
                  <div key={key} className="rounded-xl border p-4">
                    {name}
                    <strong className="float-right">
                      {
                        questions.filter((q) =>
                          isCorrectAnswer(
                            session.answers[q.questionId] || "",
                            session.details[q.questionId]?.correct_answer,
                          ),
                        ).length
                      }{" "}
                      / {questions.length}
                    </strong>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                className={button}
                disabled={busy}
                onClick={() => void shareResult()}
              >
                {busy ? "Creating link…" : "Send result to teacher’s Telegram"}
              </button>
              <Link
                className={button}
                href={`/review-session?local=${encodeURIComponent(session.id || "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Review answers ↗
              </Link>
              <Link className={button} href={`/results?local=${session.id}`}>
                Practice mistakes by category
              </Link>
              <button
                className={button}
                onClick={() => setConfirmation("restart")}
              >
                Start over
              </button>
            </div>
            {shareUrl && (
              <p className="mt-4 break-all">
                {shareUrl}{" "}
                <button
                  className="underline"
                  onClick={() => void navigator.clipboard.writeText(shareUrl)}
                >
                  Copy link
                </button>
              </p>
            )}
            {shareUrl && assignmentToken && (
              <SendSatResult
                assignmentToken={assignmentToken}
                resultUrl={shareUrl}
              />
            )}
          </section>
        )}
        {(active || (stage === "done" && review)) &&
          !session.paused &&
          item && (
            <section className="py-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-semibold">
                  {stage === "done"
                    ? "Review"
                    : isMath
                      ? "Math"
                      : "Reading and Writing"}{" "}
                  · Question {session.index + 1} of {module.length}
                </h1>
                <span className="text-sm text-neutral-500">
                  {names[item.primary_class_cd]}
                </span>
              </div>
              <div className="mb-5">
                <AssessmentWorkspaceActions
                  sessionId={session.id || "full-test"}
                  question={workspaceQuestions.find(
                    (q) => q.id === item.questionId,
                  )}
                  questions={workspaceQuestions}
                  title="Full-length test"
                  showSolutions={stage === "done"}
                  notes={session.notes[item.questionId] || ""}
                  onNotesChange={(value) =>
                    setSession((old) => ({
                      ...old,
                      notes: { ...old.notes, [item.questionId]: value },
                    }))
                  }
                />
              </div>
              <div
                className={`assessment-question-grid ${hasStimulus || showMathPanel ? "" : "assessment-question-centered"}`}
              >
                <AssessmentMathPanel hidden={!showMathPanel} />
                {hasStimulus && (
                  <div className="sat-test-passage rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
                    <AnnotatedPassage
                      questionId={item.questionId}
                      html={!isMath ? fillQuestionBlank(detail?.stimulus || "", detail?.answerOptions, session.answers[item.questionId]) : detail?.stimulus || ""}
                      blankOptions={!isMath ? detail?.answerOptions : undefined}
                      selectedBlankAnswer={session.answers[item.questionId]}
                    />
                  </div>
                )}
                <div className="assessment-question">
                  {detail ? (
                    <>
                      <AnnotatedPassage
                        questionId={`${item.questionId}:stem`}
                        html={!isMath ? fillQuestionBlank(detail.stem, detail.answerOptions, session.answers[item.questionId]) : detail.stem}
                        className="mb-6"
                      />
                      {detail.answerOptions ? (
                        <AssessmentAnswerOptions
                          options={detail.answerOptions}
                          selected={session.answers[item.questionId]}
                          eliminated={Object.fromEntries(
                            (session.eliminated[item.questionId] || []).map(
                              (key) => [key, true],
                            ),
                          )}
                          onSelect={setAnswer}
                          disabled={stage === "done"}
                          checked={stage === "done"}
                          correctAnswers={detail.correct_answer}
                          onEliminate={
                            stage === "done"
                              ? undefined
                              : (key) =>
                                  setSession((old) => {
                                    const options =
                                      old.eliminated[item.questionId] || [];
                                    return {
                                      ...old,
                                      eliminated: {
                                        ...old.eliminated,
                                        [item.questionId]: options.includes(key)
                                          ? options.filter(
                                              (value) => value !== key,
                                            )
                                          : [...options, key],
                                      },
                                    };
                                  })
                          }
                        />
                      ) : (
                        <AssessmentAnswerInput
                          value={session.answers[item.questionId] || ""}
                          onChange={setAnswer}
                          disabled={stage === "done"}
                          checked={stage === "done"}
                          correct={isCorrectAnswer(
                            session.answers[item.questionId] || "",
                            detail.correct_answer,
                          )}
                        />
                      )}
                    </>
                  ) : (
                    <p>Loading question…</p>
                  )}
                </div>
                {stage === "done" && detail && (
                  <AssessmentExplanation
                    html={detail.rationale}
                    questionId={item.questionId}
                  />
                )}
              </div>
              <div className="assessment-sticky-navigation mt-8">
                <button
                  className={button}
                  disabled={session.index === 0}
                  onClick={() =>
                    setSession((old) => ({ ...old, index: old.index - 1 }))
                  }
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={session.index >= module.length - 1}
                  onClick={() =>
                    setSession((old) => ({ ...old, index: old.index + 1 }))
                  }
                >
                  Next
                </button>
                {active && (
                  <button
                    className={`${button} ml-auto`}
                    onClick={() => setConfirmation("finish")}
                  >
                    Finish module
                  </button>
                )}
                {stage === "done" && (
                  <>
                    <button className={button} onClick={() => setReview(false)}>
                      Back to results
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
      </div>
      <AssessmentConfirm
        open={Boolean(confirmation)}
        title={
          confirmation === "finish"
            ? "Finish this module?"
            : "Start a new full-length test?"
        }
        description={
          confirmation === "finish"
            ? "Your answers will be saved. You cannot return to this module after continuing."
            : "This test remains in your device history. You can review it from Practice sessions."
        }
        confirmLabel={
          confirmation === "finish" ? "Finish module" : "Start over"
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation === "finish") advance();
          else {
            setReview(false);
            setSession(empty);
          }
          setConfirmation(null);
        }}
      />
    </main>
  );
}
