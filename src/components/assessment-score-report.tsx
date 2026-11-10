"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { domainNames } from "@/lib/assessment-workspace";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
import { isCorrectAnswer, readLocalAssessments } from "@/lib/local-assessments";
import type { LocalAssessment } from "@/lib/local-assessments";
import { practiceScore } from "@/lib/practice-score";
import { skillCdsObjectData } from "@/static-data/domains";
import { AssessmentResultsSidebar, type ResultsSection } from "@/components/assessment-results-sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QuestionCounts = {
  total: number;
  scored: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  unscored: number;
};

function countsFor(questions: WorkspaceQuestion[]): QuestionCounts {
  const scoredQuestions = questions.filter(
    (question) =>
      (question.detail?.correct_answer || question.correctAnswers)?.length,
  );
  const answeredQuestions = questions.filter((question) =>
    question.answer?.trim(),
  );
  const correct = scoredQuestions.filter((question) =>
    isCorrectAnswer(
      question.answer || "",
      question.detail?.correct_answer || question.correctAnswers,
    ),
  ).length;
  const scoredAnswered = answeredQuestions.filter(
    (question) =>
      (question.detail?.correct_answer || question.correctAnswers)?.length,
  ).length;

  return {
    total: questions.length,
    scored: scoredQuestions.length,
    answered: answeredQuestions.length,
    correct,
    incorrect: scoredAnswered - correct,
    unanswered: questions.length - answeredQuestions.length,
    unscored: answeredQuestions.length - scoredAnswered,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const groupKey = key(item) || "Other";
    (groups[groupKey] ||= []).push(item);
    return groups;
  }, {});
}

function BreakdownDetails({
  questions,
  className = "",
}: {
  questions: WorkspaceQuestion[];
  className?: string;
}) {
  const all = countsFor(questions);
  const score = practiceScore(questions);
  const categories = Object.entries(
    groupBy(questions, (question) => question.domain),
  );

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <span>Correct</span>
        <strong>{all.correct}</strong>
        <span>Incorrect</span>
        <strong>{all.incorrect}</strong>
        <span>Unanswered</span>
        <strong>{all.unanswered}</strong>
        {all.unscored > 0 && (
          <>
            <span>Answer key unavailable</span>
            <strong>{all.unscored}</strong>
          </>
        )}
      </div>
      {score.score !== null && (
        <div className="mt-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
          {score.reading.total > 0 && (
            <p>
              Reading &amp; Writing estimate:{" "}
              <strong>{score.reading.score}/800</strong>
            </p>
          )}
          {score.math.total > 0 && (
            <p>
              Math estimate: <strong>{score.math.score}/800</strong>
            </p>
          )}
          {score.projected && (
            <p className="mt-1 text-xs text-neutral-500">
              Single-section estimate; unofficial.
            </p>
          )}
        </div>
      )}
      {categories.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-700">
          {categories.map(([domain, domainQuestions]) => {
            const stats = countsFor(domainQuestions);
            const skills = Object.entries(
              groupBy(domainQuestions, (question) => question.skill || ""),
            );
            return (
              <div key={domain}>
                <div className="flex justify-between gap-4">
                  <span>{domainNames[domain] || domain}</span>
                  <strong>
                    {stats.correct}/{stats.scored} correct
                  </strong>
                </div>
                <p className="text-xs text-neutral-500">
                  {stats.incorrect} incorrect · {stats.unanswered} unanswered
                  {stats.unscored ? ` · ${stats.unscored} not scored` : ""}
                </p>
                {skills.length > 1 && (
                  <ul className="mt-1 space-y-1 pl-3 text-xs text-neutral-500">
                    {skills.map(([skill, skillQuestions]) => {
                      const skillStats = countsFor(skillQuestions);
                      return (
                        <li key={skill} className="flex justify-between gap-3">
                          <span>
                            {skillCdsObjectData[skill]?.text ||
                              skill ||
                              "Other skills"}
                          </span>
                          <span>
                            {skillStats.correct}/{skillStats.scored} correct
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScoreBreakdownTooltip({
  questions,
  label = "Score breakdown",
}: {
  questions: WorkspaceQuestion[];
  label?: string;
}) {
  const score = practiceScore(questions);
  const counts = countsFor(questions);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label={`${label}: ${counts.correct} correct, ${counts.incorrect} incorrect, ${counts.unanswered} unanswered`}
          >
            {label}
            <Info size={14} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="z-[300] max-h-[min(70vh,28rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-menu dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        >
          <BreakdownDetails questions={questions} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AssessmentScoreReport({
  title,
  questions,
  onReview,
  reviewHref,
  actions,
  timeSpentMs,
  subtitle,
  scoreLoading = false,
  assessmentId,
  showNavigation = false,
  onNavigateReview,
  onNavigateSharing,
}: {
  title: string;
  questions: WorkspaceQuestion[];
  onReview?: () => void;
  reviewHref?: string;
  actions?: ReactNode;
  timeSpentMs?: number;
  subtitle?: string;
  scoreLoading?: boolean;
  assessmentId?: string;
  showNavigation?: boolean;
  onNavigateReview?: () => void;
  onNavigateSharing?: () => void;
}) {
  const [history, setHistory] = useState<LocalAssessment[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [navigationActive, setNavigationActive] = useState<ResultsSection>("summary");
  useEffect(() => {
    if (assessmentId) setHistory(readLocalAssessments());
  }, [assessmentId]);
  const counts = countsFor(questions);
  const score = practiceScore(questions);
  const categories = Object.entries(
    groupBy(questions, (question) => question.domain),
  );
  const accuracyDenominator = counts.correct + counts.incorrect;
  const accuracy = accuracyDenominator
    ? `${Math.round((counts.correct / accuracyDenominator) * 100)}%`
    : "—";
  const sectionQuestions = {
    reading: questions.filter(
      (question) => !["H", "P", "Q", "S"].includes(question.domain),
    ),
    math: questions.filter((question) =>
      ["H", "P", "Q", "S"].includes(question.domain),
    ),
  };
  const hasAnswerKey = (question: WorkspaceQuestion) =>
    Boolean(
      (question.detail?.correct_answer || question.correctAnswers)?.length,
    );
  const time =
    timeSpentMs === undefined
      ? null
      : `${Math.floor(timeSpentMs / 60000)}:${String(Math.floor((timeSpentMs % 60000) / 1000)).padStart(2, "0")}`;
  const previousAssessment = useMemo(() => {
    if (!assessmentId) return undefined;
    const current = history.find((assessment) => assessment.id === assessmentId);
    const currentTime = Date.parse(current?.startedAt || "") || Date.now();
    return history.find(
      (assessment) =>
        assessment.kind === "full" &&
        assessment.status === "completed" &&
        assessment.id !== assessmentId &&
        (Date.parse(assessment.startedAt || assessment.updatedAt) || 0) < currentTime,
    );
  }, [assessmentId, history]);
  const previousQuestions: WorkspaceQuestion[] = previousAssessment?.questions.map((question) => ({
    id: question.id,
    externalId: question.externalId,
    domain: question.domain,
    skill: question.skill,
    answer: question.answer,
    correctAnswers: question.correctAnswers,
    detail: question.detail,
  })) || [];
  const previousScore = previousQuestions.length ? practiceScore(previousQuestions) : null;
  const currentBySection = [
    { label: "Reading & Writing", current: score.reading.score, previous: previousScore?.reading.score },
    { label: "Math", current: score.math.score, previous: previousScore?.math.score },
  ];
  const selectNavigation = (section: ResultsSection) => {
    setNavigationActive(section);
    if (section === "review") onNavigateReview?.();
    if (section === "sharing") onNavigateSharing?.();
    if (section === "sharing" && !onNavigateSharing)
      document.getElementById("export-sharing")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`assessment-score-layout${showNavigation ? " has-sidebar" : ""}`}>
      {showNavigation && <AssessmentResultsSidebar active={navigationActive} onSelect={selectNavigation} />}
      <section className="assessment-score-report mx-auto min-h-[calc(100dvh-7rem)] max-w-6xl px-4 py-5 text-neutral-950 dark:text-neutral-100 sm:px-6 sm:py-7">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Score report · Unofficial practice
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>
            )}
            {scoreLoading && (
              <p role="status" className="mt-2 text-sm text-neutral-500">
                Loading remaining answer keys for a complete breakdown…
              </p>
            )}
            {assessmentId && (
              <button
                type="button"
                className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-700 dark:hover:bg-neutral-900"
                onClick={() => setComparisonOpen(true)}
              >
                Detailed results and test comparison
              </button>
            )}
          </div>
          <ScoreBreakdownTooltip questions={questions} />
        </header>

        <section
          aria-label="Overall results"
          className="grid gap-3 md:grid-cols-[1.15fr_2fr]"
        >
          <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-menu dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
            <p className="text-sm font-medium text-neutral-500">
              Estimated SAT score
            </p>
            <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
              {score.score === null ? "—" : score.score}
              {score.score !== null && (
                <span className="ml-2 text-lg font-normal text-neutral-500">
                  /1600
                </span>
              )}
            </p>
            <p className="mt-3 text-sm text-neutral-500">
              {score.score === null
                ? "An estimate is unavailable until all answer keys load."
                : score.projected
                  ? "Single-section projection; the official SAT uses adaptive scoring."
                  : "Approximate only. This practice score is not an official SAT score."}
            </p>
            {time && (
              <p className="mt-4 text-xs text-neutral-500">
                Time spent · {time}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Correct", value: counts.correct },
              { label: "Incorrect", value: counts.incorrect },
              { label: "Unanswered", value: counts.unanswered },
              { label: "Accuracy", value: accuracy },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex min-h-24 flex-col justify-between rounded-3xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 sm:min-h-28 sm:p-4"
              >
                <span className="text-sm text-neutral-500">{stat.label}</span>
                <strong className="text-3xl font-semibold tabular-nums">
                  {stat.value}
                </strong>
                {stat.label === "Correct" && (
                  <span className="text-xs text-neutral-500">
                    of {counts.scored} scored
                  </span>
                )}
                {stat.label === "Incorrect" && (
                  <span className="text-xs text-neutral-500">
                    scored answers
                  </span>
                )}
                {stat.label === "Unanswered" && (
                  <span className="text-xs text-neutral-500">
                    of {counts.total} questions
                  </span>
                )}
                {stat.label === "Accuracy" && (
                  <span className="text-xs text-neutral-500">
                    among scored questions
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section
          aria-label="Estimated section scores"
          className="mt-3 grid gap-2 sm:grid-cols-2"
        >
          {[
            {
              label: "Reading & Writing",
              score: score.reading,
              questions: sectionQuestions.reading,
              complete: sectionQuestions.reading.every(hasAnswerKey),
            },
            {
              label: "Math",
              score: score.math,
              questions: sectionQuestions.math,
              complete: sectionQuestions.math.every(hasAnswerKey),
            },
          ]
            .filter((section) => section.score.total > 0)
            .map((section) => {
              const sectionCounts = countsFor(section.questions);
              return (
                <div
                  key={section.label}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div>
                    <h2 className="font-semibold">{section.label}</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      {sectionCounts.correct}/{sectionCounts.total} points ·{" "}
                      {sectionCounts.incorrect} incorrect ·{" "}
                      {sectionCounts.unanswered} unanswered
                    </p>
                    {!section.complete && (
                      <p className="mt-1 text-xs text-neutral-500">
                        Estimate pending answer keys
                      </p>
                    )}
                    {score.projected && section.complete && (
                      <p className="mt-1 text-xs text-neutral-500">
                        Single-section projection
                      </p>
                    )}
                  </div>
                  <strong className="shrink-0 text-3xl font-semibold tabular-nums">
                    {section.complete ? (section.score.score ?? "—") : "—"}
                    <span className="ml-1 text-sm font-normal text-neutral-500">
                      /800
                    </span>
                  </strong>
                </div>
              );
            })}
        </section>

        <section className="mt-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-menu dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Section performance</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Hover or focus a category for correct, incorrect, unanswered,
                and skill details.
              </p>
            </div>
            {counts.total - counts.scored > 0 && (
              <span className="text-xs text-neutral-500">
                {counts.total - counts.scored} question(s) lack an answer key
                and are excluded from the estimate.
              </span>
            )}
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {categories.map(([domain, domainQuestions]) => {
              const stats = countsFor(domainQuestions);
              const answeredScored = stats.correct + stats.incorrect;
              const percent = answeredScored
                ? Math.round((stats.correct / answeredScored) * 100)
                : 0;
              const skillGroups = Object.entries(
                groupBy(domainQuestions, (question) => question.skill || ""),
              );
              return (
                <Tooltip key={domain}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-neutral-200 p-3 text-left transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-semibold">
                          {domainNames[domain] || domain}
                        </span>
                        <span className="text-sm tabular-nums text-neutral-500">
                          {stats.correct}/{stats.total} pts · {percent}%
                          answered
                        </span>
                      </span>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <span
                          className="block h-full rounded-full bg-neutral-900 dark:bg-neutral-100"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          {stats.correct}/{stats.total} points · {percent}%
                          answered accuracy · {stats.unanswered} unanswered
                        </span>
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="z-[300] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-menu dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
                  >
                    <div className="font-semibold">
                      {domainNames[domain] || domain}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span>Correct</span>
                      <strong>{stats.correct}</strong>
                      <span>Incorrect</span>
                      <strong>{stats.incorrect}</strong>
                      <span>Unanswered</span>
                      <strong>{stats.unanswered}</strong>
                      {stats.unscored > 0 && (
                        <>
                          <span>Not scored</span>
                          <strong>{stats.unscored}</strong>
                        </>
                      )}
                    </div>
                    {skillGroups.length > 0 && (
                      <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-700">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Question categories
                        </p>
                        <ul className="space-y-1.5 text-xs">
                          {skillGroups.map(([skill, skillQuestions]) => {
                            const skillStats = countsFor(skillQuestions);
                            return (
                              <li
                                key={skill}
                                className="flex justify-between gap-3"
                              >
                                <span>
                                  {skillCdsObjectData[skill]?.text ||
                                    skill ||
                                    "Other skills"}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {skillStats.correct}/{skillStats.scored}{" "}
                                  correct · {skillStats.unanswered} left
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Category points show correct answers out of all questions in that
            category; accuracy is calculated from answered questions with
            available keys. SAT section scores are approximate, not official
            College Board scores.
          </p>
        </section>

        {(reviewHref || onReview) && (
          <div className="mt-4">
            {reviewHref ? (
              <Link
                href={reviewHref}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Review answers <ArrowRight size={16} />
              </Link>
            ) : onReview ? (
              <button
                type="button"
                onClick={onReview}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
              >
                Review answers <ArrowRight size={16} />
              </button>
            ) : null}
          </div>
        )}
        {actions && (
          <div id="export-sharing" className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            {actions}
          </div>
        )}
      </section>
      </div>
      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="assessment-modal assessment-modal--compact max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="assessment-modal-title">Detailed results</DialogTitle>
            <DialogDescription className="assessment-modal-copy">
              {previousAssessment
                ? `Compared with your previous completed full-length test${previousAssessment.startedAt ? ` from ${new Date(previousAssessment.startedAt).toLocaleDateString()}` : ""}. Score estimates are unofficial.`
                : "A comparison will appear after you complete another full-length test on this device."}
            </DialogDescription>
          </DialogHeader>
          {previousAssessment && previousScore && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2 text-sm">
                <strong>Measure</strong><strong>This test</strong><strong>Previous</strong><strong>Change</strong>
                <span>Estimated total</span>
                <strong>{score.score ?? "—"}</strong>
                <strong>{previousScore.score ?? "—"}</strong>
                <strong>{score.score !== null && previousScore.score !== null ? `${score.score - previousScore.score > 0 ? "+" : ""}${score.score - previousScore.score}` : "—"}</strong>
                {currentBySection.map((section) => (
                  <FragmentComparisonRow key={section.label} {...section} />
                ))}
                <span>Correct answers</span>
                <strong>{counts.correct}</strong>
                <strong>{countsFor(previousQuestions).correct}</strong>
                <strong>{counts.correct - countsFor(previousQuestions).correct > 0 ? "+" : ""}{counts.correct - countsFor(previousQuestions).correct}</strong>
              </div>
              <section className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
                <h3 className="mb-3 text-sm font-semibold">Question category comparison</h3>
                <div className="space-y-2 text-sm">
                  {categories.map(([domain, domainQuestions]) => {
                    const currentStats = countsFor(domainQuestions);
                    const priorStats = countsFor(previousQuestions.filter((question) => question.domain === domain));
                    const delta = currentStats.correct - priorStats.correct;
                    return (
                      <div key={domain} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2 dark:border-neutral-700">
                        <span className="font-medium">{domainNames[domain] || domain}</span>
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {currentStats.correct}/{currentStats.total} now · {priorStats.correct}/{priorStats.total} before · {delta > 0 ? "+" : ""}{delta} correct
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function FragmentComparisonRow({
  label,
  current,
  previous,
}: {
  label: string;
  current?: number | null;
  previous?: number | null;
}) {
  const change = current != null && previous != null ? current - previous : undefined;
  return (
    <>
      <span>{label}</span>
      <strong>{current ?? "—"}</strong>
      <strong>{previous ?? "—"}</strong>
      <strong>{change === undefined ? "—" : `${change > 0 ? "+" : ""}${change}`}</strong>
    </>
  );
}
