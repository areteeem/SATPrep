"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MathJax } from "better-react-mathjax";
import type {
  PlainQuestionType,
  API_Response_Question,
} from "@/types/question";
import { satRequest, type PracticeSettings } from "@/lib/satSharing";
import { saveLocalAssessment } from "@/lib/local-assessments";
import { AssessmentWorkspaceActions } from "@/components/assessment-workspace-actions";
import { fillQuestionBlank } from "@/lib/assessment-blanks";
import { AssessmentCompletion } from "@/components/assessment-completion";
import { AnnotatedPassage } from "@/components/annotated-passage";
import {
  AssessmentActivePage,
  AssessmentAnswerOptions,
  AssessmentAnswerInput,
  AssessmentConfirm,
  assessmentButton as button,
  hasAssessmentContent,
} from "@/components/assessment-controls";
import {
  AssessmentCalculatorTools,
  AssessmentMathPanel,
} from "@/components/assessment-calculator-tools";
import { AssessmentCountdown } from "@/components/assessment-countdown";

type State = {
  id?: string;
  startedAt?: string;
  questions: PlainQuestionType[];
  answers: Record<string, string>;
  index: number;
  deadline: number;
  done: boolean;
  notes?: Record<string, string>;
  eliminated?: Record<string, string[]>;
  details?: Record<string, API_Response_Question>;
};
function readOptions(encoded: string): Partial<PracticeSettings> {
  try {
    const value = JSON.parse(decodeURIComponent(encoded));
    return {
      assessment: ["SAT", "PSAT/NMSQT", "PSAT"].includes(value.assessment)
        ? value.assessment
        : "SAT",
      subject: ["math", "reading-writing"].includes(value.subject)
        ? value.subject
        : undefined,
      skills: Array.isArray(value.skills)
        ? value.skills.filter(
            (s: unknown) => typeof s === "string" && /^[A-Z.]{1,8}$/.test(s),
          )
        : undefined,
      difficulties: Array.isArray(value.difficulties)
        ? value.difficulties.filter((d: string) => ["E", "M", "H"].includes(d))
        : undefined,
      randomize: value.randomize !== false,
      excludeBluebook: value.excludeBluebook === true,
    };
  } catch {
    return {};
  }
}
export default function Assignment() {
  const [teacher, setTeacher] = useState<{
    name: string;
    telegramConnected: boolean;
  } | null>(null);
  const [token, setToken] = useState(""),
    [settings, setSettings] = useState<PracticeSettings | null>(null),
    [state, setState] = useState<State | null>(null),
    [detail, setDetail] = useState<API_Response_Question | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmFinish, setConfirmFinish] = useState(false);
  useEffect(() => {
    const raw =
      location.hash.slice(1) ||
      sessionStorage.getItem("sat-current-assignment") ||
      "";
    const [value, encoded = ""] = raw.split("~");
    if (raw) sessionStorage.setItem("sat-current-assignment", raw);
    history.replaceState(null, "", location.pathname);
    if (!/^[a-f0-9]{64}$/.test(value)) {
      setError("This assignment link is invalid.");
      return;
    }
    setToken(value);
    void satRequest<{
      settings: PracticeSettings;
      teacher?: { name: string; telegramConnected: boolean };
    }>("resolve_assignment", {
      token: value,
    })
      .then((data) => {
        setSettings({ ...data.settings, ...readOptions(encoded) });
        setTeacher(data.teacher || null);
        try {
          const saved = localStorage.getItem(`sat-custom:${value}`);
          if (saved) setState(JSON.parse(saved));
        } catch {}
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!token || !state) return;
    try {
      localStorage.setItem(`sat-custom:${token}`, JSON.stringify(state));
      if (state.id)
        saveLocalAssessment({
          id: state.id,
          assignmentToken: token,
          kind: "custom",
          title: "Assigned practice",
          startedAt: state.startedAt || "",
          updatedAt: new Date().toISOString(),
          status: state.done ? "completed" : "in_progress",
          questions: state.questions.map((q) => ({
            id: q.questionId,
            externalId: q.external_id || q.ibn || "",
            domain: q.primary_class_cd,
            skill: q.skill_cd,
            answer: state.answers[q.questionId] || "",
            detail: state.details?.[q.questionId],
            correctAnswers: state.details?.[q.questionId]?.correct_answer,
          })),
        });
    } catch {
      setError("Could not save your progress on this device.");
    }
  }, [token, state]);
  useEffect(() => {
    if (!state || state.done) return;
    const timer = setTimeout(
      () => setState((old) => (old ? { ...old, done: true } : old)),
      Math.max(0, state.deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state?.deadline, state?.done]);
  const item = state?.questions[state.index],
    isMath = item && ["H", "P", "Q", "S"].includes(item.primary_class_cd),
    hasStimulus = hasAssessmentContent(detail?.stimulus);
  useEffect(() => {
    if (!item) return;
    const controller = new AbortController();
    setDetail(null);
    fetch(
      `/api/question/${encodeURIComponent(item.external_id || item.ibn || "")}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.data)
          throw new Error("Question could not be loaded.");
        setDetail(data.data);
        setState((old) =>
          old
            ? {
                ...old,
                details: { ...old.details, [item.questionId]: data.data },
              }
            : old,
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [item]);
  async function start() {
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/get-questions?assessment=${encodeURIComponent(settings.assessment || "SAT")}&domains=${settings.domains.join(",")}`,
      );
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.data))
        throw new Error("Question bank is unavailable.");
      let pool = (data.data as PlainQuestionType[]).filter(
        (q) =>
          (q.external_id || q.ibn) &&
          (!settings.skills?.length || settings.skills.includes(q.skill_cd)) &&
          (!settings.difficulties?.length ||
            settings.difficulties.includes(q.difficulty)),
      );
      if (settings.excludeBluebook) {
        const response = await fetch("/api/lookup");
        const lookup = await response.json();
        if (!response.ok || !lookup.data)
          throw new Error(
            "Bluebook exclusions could not be loaded. Try again.",
          );
        const excluded = new Set([
          ...(lookup.data.mathLiveItems || []),
          ...(lookup.data.readingLiveItems || []),
        ]);
        pool = pool.filter(
          (q) => !q.external_id || !excluded.has(q.external_id),
        );
      }
      if (settings.randomize !== false) pool.sort(() => Math.random() - 0.5);
      if (pool.length < settings.count)
        throw new Error(
          `Only ${pool.length} questions match the assigned skills and settings; ${settings.count} are required.`,
        );
      setState({
        id: `assignment-${Date.now()}`,
        startedAt: new Date().toISOString(),
        questions: pool.slice(0, settings.count),
        answers: {},
        index: 0,
        deadline: Date.now() + settings.minutes * 60000,
        done: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start practice.");
    } finally {
      setBusy(false);
    }
  }
  const setAnswer = (value: string | null) =>
    item &&
    setState((old) =>
      old
        ? {
            ...old,
            answers: { ...old.answers, [item.questionId]: value || "" },
          }
        : old,
    );
  return (
    <main
      className="assessment-full-page mx-auto min-h-dvh max-w-7xl px-5 py-6"
      data-assessment-content
    >
      <AssessmentActivePage active={Boolean(state && !state.done)} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <Link href="/results">← Practice sessions</Link>
        {state && !state.done && (
          <div className="flex flex-wrap items-center gap-3">
            <AssessmentCountdown deadline={state.deadline} />
            {isMath && hasStimulus && <AssessmentCalculatorTools />}
          </div>
        )}
      </header>
      {error && (
        <p className="mt-5 text-red-700" role="alert">
          {error}
        </p>
      )}
      {!settings && !error && <p className="mt-8">Loading assignment…</p>}
      {settings && !state && (
        <section className="py-12">
          <h1 className="text-3xl font-semibold">
            Your {settings.assessment || "SAT"} practice
          </h1>
          <p className="mt-4 rounded-xl border p-4 text-sm">
            {teacher
              ? `This practice is linked to ${teacher.name}.`
              : "This practice is linked to your assigning teacher."}{" "}
            Your result will be connected to this assignment.{" "}
            {teacher?.telegramConnected === false
              ? "Your teacher needs to connect Telegram to receive it there."
              : "You can send your result directly to the teacher’s Telegram after finishing."}
          </p>
          <p className="mt-4">
            {settings.mode === "full"
              ? "Full-length test"
              : `${settings.count} questions · ${settings.minutes} minutes`}
          </p>
          <button
            className={`${button} mt-6`}
            disabled={busy}
            onClick={() => {
              if (settings.mode === "full") {
                sessionStorage.setItem("sat-assignment-token", token);
                location.assign("/full-test?assigned=1");
              } else void start();
            }}
          >
            {busy ? "Preparing…" : "Start practice"}
          </button>
        </section>
      )}
      {state && (
        <section className="py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-semibold">
              {state.done
                ? "Practice complete"
                : `Question ${state.index + 1} of ${state.questions.length}`}
            </h1>
            {!state.done && item && (
              <AssessmentWorkspaceActions
                sessionId={state.id || token}
                question={{
                  id: item.questionId,
                  externalId: item.external_id || item.ibn || "",
                  domain: item.primary_class_cd,
                  answer: state.answers[item.questionId] || "",
                  detail: state.details?.[item.questionId] || undefined,
                }}
                questions={state.questions.map((q) => ({
                  id: q.questionId,
                  externalId: q.external_id || q.ibn || "",
                  domain: q.primary_class_cd,
                  answer: state.answers[q.questionId] || "",
                  detail: state.details?.[q.questionId],
                }))}
                title="Assigned practice"
              />
            )}
          </div>
          {state.done ? (
            <div>
              <AssessmentCompletion
                localId={state.id || ""}
                assignmentToken={token}
                result={{
                  mode: "custom",
                  questions: state.questions.map((q) => ({
                    id: q.questionId,
                    externalId: q.external_id || q.ibn || "",
                    domain: q.primary_class_cd,
                    answer: state.answers[q.questionId] || "",
                  })),
                }}
              />
              <Link
                className={`${button} mt-5`}
                href={`/results?local=${state.id}`}
              >
                Review on this device
              </Link>
            </div>
          ) : (
            item && (
              <>
                <div
                  className={`assessment-question-grid ${hasStimulus || isMath ? "" : "assessment-question-centered"}`}
                >
                  <AssessmentMathPanel hidden={!isMath || hasStimulus} />
                  {hasStimulus && (
                    <div className="rounded-xl border p-5">
                      <AnnotatedPassage
                        questionId={item.questionId}
                        html={!isMath ? fillQuestionBlank(detail?.stimulus || "", detail?.answerOptions, state.answers[item.questionId]) : detail?.stimulus || ""}
                        blankOptions={!isMath ? detail?.answerOptions : undefined}
                        selectedBlankAnswer={state.answers[item.questionId]}
                      />
                    </div>
                  )}
                  <div>
                    {detail ? (
                      <>
                        <AnnotatedPassage
                          questionId={`${item.questionId}:stem`}
                          html={!isMath ? fillQuestionBlank(detail.stem, detail.answerOptions, state.answers[item.questionId]) : detail.stem}
                          className="mb-6"
                        />
                        {detail.answerOptions ? (
                          <AssessmentAnswerOptions
                            options={detail.answerOptions}
                            selected={state.answers[item.questionId]}
                            onSelect={setAnswer}
                            eliminated={Object.fromEntries(
                              (state.eliminated?.[item.questionId] || []).map(
                                (key) => [key, true],
                              ),
                            )}
                            onEliminate={(key) =>
                              setState((old) => {
                                if (!old) return old;
                                const prior =
                                  old.eliminated?.[item.questionId] || [];
                                return {
                                  ...old,
                                  eliminated: {
                                    ...old.eliminated,
                                    [item.questionId]: prior.includes(key)
                                      ? prior.filter((k) => k !== key)
                                      : [...prior, key],
                                  },
                                };
                              })
                            }
                          />
                        ) : (
                          <AssessmentAnswerInput
                            value={state.answers[item.questionId] || ""}
                            onChange={setAnswer}
                          />
                        )}
                      </>
                    ) : (
                      <p>Loading question…</p>
                    )}
                  </div>
                </div>
                <div className="assessment-sticky-navigation mt-8 flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={!state.index}
                    onClick={() =>
                      setState((old) =>
                        old ? { ...old, index: old.index - 1 } : old,
                      )
                    }
                  >
                    Previous
                  </button>
                  <button
                    className={button}
                    disabled={state.index === state.questions.length - 1}
                    onClick={() =>
                      setState((old) =>
                        old ? { ...old, index: old.index + 1 } : old,
                      )
                    }
                  >
                    Next
                  </button>
                  <button
                    className={`${button} ml-auto`}
                    onClick={() => setConfirmFinish(true)}
                  >
                    Finish
                  </button>
                </div>
              </>
            )
          )}
        </section>
      )}
      <AssessmentConfirm
        open={confirmFinish}
        title="Finish this assignment?"
        description="Your answers will be saved, and you can review the completed practice from this device."
        confirmLabel="Finish assignment"
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          setState((old) => (old ? { ...old, done: true } : old));
          setConfirmFinish(false);
        }}
      />
    </main>
  );
}
