"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MathJax } from "better-react-mathjax";
import { BookOpen, Clock3, History, Play } from "lucide-react";
import {
  isCorrectAnswer,
  readLocalAssessments,
  saveLocalAssessment,
} from "@/lib/local-assessments";
import type { LocalAssessment, LocalQuestion } from "@/lib/local-assessments";
import type {
  API_Response_Question,
  PlainQuestionType,
} from "@/types/question";
import { AssessmentExplanation } from "@/components/assessment-workspace-actions";
import { AnnotatedPassage } from "@/components/annotated-passage";
import {
  AssessmentAnswerInput,
  AssessmentAnswerOptions,
  assessmentButton as button,
  hasAssessmentContent,
} from "@/components/assessment-controls";
import {
  AssessmentMathPanel,
  AssessmentCalculatorTools,
} from "@/components/assessment-calculator-tools";

const domainNames: Record<string, string> = {
  INI: "Information and Ideas",
  CAS: "Craft and Structure",
  EOI: "Expression of Ideas",
  SEC: "Standard English Conventions",
  H: "Algebra",
  P: "Advanced Math",
  Q: "Problem-Solving and Data Analysis",
  S: "Geometry and Trigonometry",
};
export function LocalAssessmentHistory() {
  const [sort, setSort] = useState("newest"),
    [search, setSearch] = useState(""),
    [sessionStatus, setSessionStatus] = useState("all"),
    [subjectFilter, setSubjectFilter] = useState("all"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [sessions, setSessions] = useState<LocalAssessment[]>([]),
    [selected, setSelected] = useState<LocalAssessment | null>(null),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [index, setIndex] = useState(0),
    [details, setDetails] = useState<Record<string, API_Response_Question>>({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [practice, setPractice] = useState<LocalQuestion[] | null>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [checked, setChecked] = useState(false),
    [finished, setFinished] = useState(false),
    [practiceBusy, setPracticeBusy] = useState(false),
    [practiceNotice, setPracticeNotice] = useState(""),
    [practiceIncludesSimilar, setPracticeIncludesSimilar] = useState(false),
    [loadedSessionId, setLoadedSessionId] = useState(""),
    [launchPractice, setLaunchPractice] = useState<{
      sessionId: string;
      includeSimilar: boolean;
    } | null>(null),
    [autoPracticeStarted, setAutoPracticeStarted] = useState("");
  useEffect(() => {
    const saved = readLocalAssessments();
    setSessions(saved);
    const params = new URLSearchParams(location.search);
    const id = params.get("local");
    if (id) setSelected(saved.find((session) => session.id === id) || null);
    if (id && params.get("practice") === "mistakes")
      setLaunchPractice({
        sessionId: id,
        includeSimilar: params.get("similar") === "1",
      });
  }, []);
  useEffect(() => {
    if (!selected) return;
    let stopped = false;
    setLoading(true);
    setLoadedSessionId("");
    setError("");
    setDetails(
      Object.fromEntries(
        selected.questions
          .filter((q) => q.detail)
          .map((q) => [q.id, q.detail!]),
      ),
    );
    void (async () => {
      for (let i = 0; i < selected.questions.length; i += 5) {
        const batch = selected.questions
          .slice(i, i + 5)
          .filter((q) => !q.detail && q.externalId);
        const entries = await Promise.all(
          batch.map(async (q) => {
            try {
              const response = await fetch(
                `/api/question/${encodeURIComponent(q.externalId)}`,
              );
              const payload = await response.json();
              return response.ok && payload.data
                ? ([q.id, payload.data] as const)
                : null;
            } catch {
              return null;
            }
          }),
        );
        if (stopped) return;
        setDetails((old) => ({
          ...old,
          ...Object.fromEntries(entries.filter((entry) => entry !== null)),
        }));
      }
      if (!stopped) {
        setLoadedSessionId(selected.id);
        setLoading(false);
      }
    })();
    return () => {
      stopped = true;
    };
  }, [selected]);
  useEffect(() => {
    if (selected)
      document
        .getElementById("local-session-review")
        ?.scrollIntoView({ block: "start" });
  }, [selected?.id]);
  const source = selected?.questions || [];
  const wrong = source.filter((q) => {
    const correct = details[q.id]?.correct_answer || q.correctAnswers;
    return (
      q.answer &&
      Boolean(correct?.length) &&
      !isCorrectAnswer(q.answer, correct)
    );
  });
  const questions =
    practice ||
    source.filter((q) => category === "all" || q.domain === category);
  const question = questions[index],
    detail = question && details[question.id];
  const isMath = question && ["H", "P", "Q", "S"].includes(question.domain);
  const hasStimulus = hasAssessmentContent(detail?.stimulus);
  const currentAnswer = question
    ? practice
      ? answers[question.id] || ""
      : question.answer
    : "";
  const startMistakes = useCallback(async (includeSimilar = false) => {
    const mistakes = wrong.filter(
      (q) => category === "all" || q.domain === category,
    );
    if (!mistakes.length) {
      setError("There are no answered mistakes in this practice set.");
      return;
    }
    setError("");
    setPracticeNotice("");
    setPracticeBusy(true);
    let similarQuestions: LocalQuestion[] = [];
    if (includeSimilar) {
      try {
        const domains = [
          ...new Set(mistakes.map((q) => q.domain).filter(Boolean)),
        ];
        const skills = [
          ...new Set(mistakes.map((q) => q.skill).filter(Boolean)),
        ];
        const params = new URLSearchParams({
          assessment: selected?.selections?.assessment || "SAT",
          domains: domains.join(","),
          excludeIds: source.map((q) => q.id).join(","),
        });
        if (skills.length) params.set("skills", skills.join(","));
        const response = await fetch(`/api/get-questions?${params}`);
        const payload = (await response.json()) as {
          success?: boolean;
          data?: PlainQuestionType[];
        };
        if (!response.ok || !payload.success || !payload.data)
          throw new Error("Could not find similar questions.");
        const candidates = payload.data.filter(
          (candidate) =>
            candidate.questionId &&
            (candidate.external_id || candidate.ibn) &&
            !source.some((q) => q.id === candidate.questionId),
        );
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const chosen = candidates.slice(0, Math.min(mistakes.length, 10));
        const loaded = await Promise.all(
          chosen.map(async (candidate) => {
            const externalId = candidate.external_id || candidate.ibn || "";
            try {
              const detailResponse = await fetch(
                `/api/question/${encodeURIComponent(externalId)}`,
              );
              const detailPayload = await detailResponse.json();
              if (!detailResponse.ok || !detailPayload.data) return null;
              return {
                id: candidate.questionId,
                externalId,
                domain: candidate.primary_class_cd,
                skill: candidate.skill_cd,
                answer: "",
                correctAnswers: detailPayload.data.correct_answer,
                detail: detailPayload.data as API_Response_Question,
              } satisfies LocalQuestion;
            } catch {
              return null;
            }
          }),
        );
        similarQuestions = loaded.filter(
          (question): question is LocalQuestion => Boolean(question),
        );
        if (similarQuestions.length) {
          setDetails((old) => ({
            ...old,
            ...Object.fromEntries(
              similarQuestions.map((question) => [
                question.id,
                question.detail!,
              ]),
            ),
          }));
        }
        setPracticeNotice(
          similarQuestions.length
            ? `Added ${similarQuestions.length} similar ${similarQuestions.length === 1 ? "question" : "questions"}, matched by skill.`
            : "No similar questions were available, so this set contains missed questions only.",
        );
      } catch {
        setPracticeNotice(
          "Similar questions could not be loaded, so this set contains missed questions only.",
        );
      }
    }
    setPractice([...mistakes, ...similarQuestions]);
    setPracticeIncludesSimilar(similarQuestions.length > 0);
    setAnswers({});
    setIndex(0);
    setChecked(false);
    setFinished(false);
    setPracticeBusy(false);
  }, [wrong, category, source, selected?.selections?.assessment]);
  useEffect(() => {
    if (
      !launchPractice ||
      !selected ||
      selected.id !== launchPractice.sessionId ||
      loading ||
      loadedSessionId !== selected.id ||
      autoPracticeStarted === `${selected.id}:${launchPractice.includeSimilar}`
    )
      return;
    setAutoPracticeStarted(`${selected.id}:${launchPractice.includeSimilar}`);
    void startMistakes(launchPractice.includeSimilar);
  }, [
    launchPractice,
    selected,
    loading,
    loadedSessionId,
    autoPracticeStarted,
    startMistakes,
  ]);
  function finishPractice() {
    if (!selected || !practice) return;
    const now = new Date().toISOString();
    try {
      saveLocalAssessment({
        id: `mistakes-${Date.now()}`,
        kind: "rush",
        title: `${practiceIncludesSimilar ? "Mistakes + similar practice" : "Mistake practice"} · ${category === "all" ? "All categories" : domainNames[category]}`,
        startedAt: now,
        updatedAt: now,
        status: "completed",
        questions: practice.map((q) => ({
          ...q,
          answer: answers[q.id] || "",
          detail: details[q.id],
          correctAnswers: details[q.id]?.correct_answer || q.correctAnswers,
        })),
      });
      setSessions(readLocalAssessments());
      setFinished(true);
    } catch {
      setError("This device could not save your mistake practice.");
    }
  }
  return (
    <section
      id="device-sessions"
      className="mt-8 space-y-5"
      data-assessment-content
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <History size={22} />
          Sessions on this device
        </h2>
        <select
          aria-label="Filter practice sessions"
          className={button}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All sessions</option>
          <option value="full">Full-length tests</option>
          <option value="rush">Practice Rushes</option>
          <option value="saved">Saved for later</option>
        </select>
      </div>
      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <input
          aria-label="Search sessions"
          placeholder="Search sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border bg-transparent p-3"
        />
        <select
          aria-label="Sort sessions"
          className={button}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="updated">Recently updated</option>
          <option value="title">Title A–Z</option>
          <option value="answered">Most answered</option>
        </select>
        <select
          aria-label="Session status"
          className={button}
          value={sessionStatus}
          onChange={(e) => setSessionStatus(e.target.value)}
        >
          <option value="all">Any status</option>
          <option value="completed">Completed</option>
          <option value="saved">Saved / in progress</option>
        </select>
        <select
          aria-label="Session subject"
          className={button}
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">Any subject</option>
          <option value="math">Math</option>
          <option value="reading">Reading & Writing</option>
        </select>
        <label className="text-xs">
          From
          <input
            aria-label="Sessions from date"
            type="date"
            className="mt-1 block w-full rounded-xl border bg-transparent p-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs">
          To
          <input
            aria-label="Sessions to date"
            type="date"
            className="mt-1 block w-full rounded-xl border bg-transparent p-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {!sessions.length && (
        <p className="rounded-xl border p-5 text-neutral-500">
          No sessions are saved on this device yet. Completed and saved tests
          will appear here.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {sessions
          .filter(
            (session) =>
              session.title.toLowerCase().includes(search.toLowerCase()) &&
              (sessionStatus === "all" ||
                (sessionStatus === "completed"
                  ? session.status === "completed"
                  : session.status !== "completed")) &&
              (subjectFilter === "all" ||
                session.questions.some(
                  (q) =>
                    ["H", "P", "Q", "S"].includes(q.domain) ===
                    (subjectFilter === "math"),
                )) &&
              (!from || Date.parse(session.startedAt) >= Date.parse(from)) &&
              (!to ||
                Date.parse(session.startedAt) < Date.parse(to) + 86400000),
          )
          .sort((a, b) =>
            sort === "title"
              ? a.title.localeCompare(b.title)
              : sort === "answered"
                ? b.questions.filter((q) => q.answer).length -
                  a.questions.filter((q) => q.answer).length
                : sort === "oldest"
                  ? (Date.parse(a.startedAt) || 0) -
                    (Date.parse(b.startedAt) || 0)
                  : sort === "updated"
                    ? (Date.parse(b.updatedAt) || 0) -
                      (Date.parse(a.updatedAt) || 0)
                    : (Date.parse(b.startedAt) || 0) -
                      (Date.parse(a.startedAt) || 0),
          )
          .filter(
            (session) =>
              filter === "all" ||
              (filter === "saved" &&
                ["saved", "in_progress", "paused"].includes(session.status)) ||
              session.kind === filter,
          )
          .map((session) => (
            <article
              key={session.id}
              className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
            >
              <h3 className="font-semibold">{session.title}</h3>
              <p className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                <Clock3 size={14} />
                {session.startedAt
                  ? new Date(session.startedAt).toLocaleString()
                  : "Older saved session · timestamp unavailable"}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                {session.status.replace(/_/g, " ")} ·{" "}
                {session.questions.filter((q) => q.answer).length} answered /{" "}
                {session.kind === "full" ? 98 : session.questions.length}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  className={button}
                  href={`/review-session?local=${encodeURIComponent(session.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BookOpen size={15} />
                  Review ↗
                </Link>
                <button
                  className={button}
                  onClick={() => {
                    setSelected(session);
                    setIndex(0);
                    setCategory("all");
                    setPractice(null);
                    setFinished(false);
                  }}
                >
                  Practice mistakes
                </button>
                {session.kind === "full" && session.status !== "completed" && (
                  <Link
                    href={`/full-test?resume=${encodeURIComponent(session.id)}`}
                    className={button}
                  >
                    <Play size={15} />
                    Resume test
                  </Link>
                )}
              </div>
            </article>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {selected && (
        <section id="local-session-review" className="space-y-5 border-t pt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {practice ? "Mistake practice" : `Review · ${selected.title}`}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {loading
                  ? "Loading question details…"
                  : `${wrong.length} answered mistakes available`}
              </p>
            </div>
            <button
              className={button}
              onClick={() => {
                setSelected(null);
                setPractice(null);
              }}
            >
              Close review
            </button>
          </div>
          {practiceBusy && (
            <p role="status" className="text-sm text-neutral-500">
              Finding skill-matched questions for your practice set…
            </p>
          )}
          {practice && practiceNotice && (
            <p role="status" className="text-sm text-neutral-500">
              {practiceNotice}
            </p>
          )}
          {!practice && (
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Mistake practice category"
                className={button}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setIndex(0);
                }}
              >
                <option value="all">All categories</option>
                {[...new Set(source.map((q) => q.domain))].map((domain) => (
                  <option key={domain} value={domain}>
                    {domainNames[domain] || domain}
                  </option>
                ))}
              </select>
              <button
                className={button}
                disabled={
                  loading ||
                  practiceBusy ||
                  !wrong.some(
                    (q) => category === "all" || q.domain === category,
                  )
                }
                onClick={() => void startMistakes(false)}
              >
                {practiceBusy ? "Preparing practice…" : "Practice mistakes in this category"}
              </button>
            </div>
          )}
          {finished ? (
            <div className="rounded-xl border p-6">
              <h3 className="text-xl font-semibold">
                Mistake practice complete
              </h3>
              <p className="mt-3">
                {
                  practice?.filter((q) =>
                    isCorrectAnswer(
                      answers[q.id] || "",
                      details[q.id]?.correct_answer || q.correctAnswers,
                    ),
                  ).length
                }{" "}
                correct out of {practice?.length}
              </p>
              <button
                className={`${button} mt-4`}
                onClick={() => {
                  setPractice(null);
                  setIndex(0);
                  setFinished(false);
                }}
              >
                Return to review
              </button>
            </div>
          ) : question ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">
                  Question {index + 1} of {questions.length} ·{" "}
                  {domainNames[question.domain]}
                </p>
                {isMath && hasStimulus && <AssessmentCalculatorTools />}
              </div>
              <div
                className={`assessment-question-grid ${hasStimulus || isMath ? "" : "assessment-question-centered"}`}
              >
                <AssessmentMathPanel hidden={!isMath || hasStimulus} />
                {hasStimulus && (
                  <div className="rounded-xl border p-5">
                    <AnnotatedPassage
                      questionId={question.id}
                      html={detail?.stimulus || ""}
                    />
                  </div>
                )}
                <div>
                  {detail ? (
                    <>
                      <MathJax dynamic>
                        <div
                          className="mb-5"
                          dangerouslySetInnerHTML={{ __html: detail.stem }}
                        />
                      </MathJax>
                      {detail.answerOptions ? (
                        <AssessmentAnswerOptions
                          options={detail.answerOptions}
                          selected={currentAnswer}
                          onSelect={(answer) =>
                            setAnswers((old) => ({
                              ...old,
                              [question.id]: answer || "",
                            }))
                          }
                          disabled={!practice || checked}
                          checked={!practice || checked}
                          correctAnswers={detail.correct_answer}
                        />
                      ) : (
                        <AssessmentAnswerInput
                          value={currentAnswer}
                          onChange={(answer) =>
                            setAnswers((old) => ({
                              ...old,
                              [question.id]: answer,
                            }))
                          }
                          disabled={!practice || checked}
                          checked={!practice || checked}
                          correct={isCorrectAnswer(
                            currentAnswer,
                            detail.correct_answer,
                          )}
                        />
                      )}
                    </>
                  ) : (
                    <p>
                      {loading
                        ? "Loading question…"
                        : "The question is unavailable. Try another saved question."}
                    </p>
                  )}
                </div>
                {detail && (!practice || checked) && (
                  <AssessmentExplanation
                    html={detail.rationale}
                    questionId={question.id}
                  />
                )}
              </div>
              <div className="assessment-sticky-navigation">
                <button
                  className={button}
                  disabled={index === 0}
                  onClick={() => {
                    setIndex(index - 1);
                    setChecked(false);
                  }}
                >
                  Previous
                </button>
                {practice && !checked ? (
                  <button
                    className={button}
                    disabled={!currentAnswer.trim() || !detail}
                    onClick={() => setChecked(true)}
                  >
                    Check answer
                  </button>
                ) : (
                  <button
                    className={button}
                    disabled={!practice && index === questions.length - 1}
                    onClick={() => {
                      if (practice && index === questions.length - 1)
                        finishPractice();
                      else {
                        setIndex(index + 1);
                        setChecked(false);
                      }
                    }}
                  >
                    {practice && index === questions.length - 1
                      ? "Finish practice"
                      : "Next"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p>No questions in this category.</p>
          )}
        </section>
      )}
    </section>
  );
}
