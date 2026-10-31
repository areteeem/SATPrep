"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ListFilter } from "lucide-react";
import { AnnotatedPassage } from "@/components/annotated-passage";
import {
  AssessmentAnswerOptions,
  AssessmentAnswerInput,
  assessmentButton as button,
  hasAssessmentContent,
} from "@/components/assessment-controls";
import {
  AssessmentWorkspaceActions,
  AssessmentExplanation,
  WhiteboardButton,
} from "@/components/assessment-workspace-actions";
import { readReviewMarks } from "@/lib/assessment-workspace";
import { domainNames } from "@/lib/assessment-workspace";
import type { WorkspaceQuestion } from "@/lib/assessment-workspace";
import { isCorrectAnswer } from "@/lib/local-assessments";
import { practiceScore } from "@/lib/practice-score";
import { ScoreBreakdownTooltip } from "@/components/assessment-score-report";
import { PracticeResultsActions } from "@/components/practice-results-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export function AssessmentReview({
  sessionId,
  title,
  questions,
  initialQuestionId = "",
  loading = false,
  actions,
}: {
  sessionId: string;
  title: string;
  questions: WorkspaceQuestion[];
  initialQuestionId?: string;
  loading?: boolean;
  actions?: React.ReactNode;
}) {
  const [marks, setMarks] = useState<string[]>([]);
  useEffect(() => {
    const update = () => setMarks(readReviewMarks(sessionId));
    update();
    window.addEventListener("sat-review-marks", update);
    return () => window.removeEventListener("sat-review-marks", update);
  }, [sessionId]);
  const [index, setIndex] = useState(0),
    [section, setSection] = useState("all"),
    [status, setStatus] = useState("all"),
    [zoom, setZoom] = useState(100),
    [showAnswers, setShowAnswers] = useState(true);
  const filtered = useMemo(
    () =>
      questions.filter(
        (q) =>
          (section === "all" ||
            (q.module || domainNames[q.domain] || q.domain) === section) &&
          (status === "all" ||
            (status === "unanswered"
              ? !q.answer
              : status === "correct"
                ? isCorrectAnswer(
                    q.answer,
                    q.detail?.correct_answer || q.correctAnswers,
                  )
                : status === "incorrect"
                  ? q.answer &&
                    !isCorrectAnswer(
                      q.answer,
                      q.detail?.correct_answer || q.correctAnswers,
                    )
                  : marks.includes(q.id))),
      ),
    [questions, section, status, marks],
  );
  const q = filtered[index],
    detail = q?.detail;
  useEffect(() => {
    if (!initialQuestionId) return;
    const target = filtered.findIndex((item) => item.id === initialQuestionId);
    if (target >= 0) setIndex(target);
  }, [initialQuestionId, questions.length]);
  useEffect(() => {
    if (index >= filtered.length) setIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, index]);
  const score = practiceScore(questions);
  const known = (q?.correctAnswers || detail?.correct_answer)?.length;
  return (
    <section className="teacher-review" data-assessment-content>
      <header className="teacher-review-header">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/results"
            className={`${button} inline-flex size-9 shrink-0 items-center justify-center p-0`}
            aria-label="Back to results"
            title="Back to results"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-base font-semibold sm:text-lg">
                {title}
              </h1>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              <span>
                {loading
                  ? "Loading review…"
                  : `${score.correct} correct · ${score.known} scored · ${score.answered} answered`}
                {score.score !== null && ` · Est. ${score.score}/1600`}
              </span>
              <ScoreBreakdownTooltip
                questions={questions}
                label="Score breakdown"
              />
            </div>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${button} inline-flex items-center gap-2 px-3`}
                aria-label="Filter review questions"
                title="Filter review questions"
              >
                <ListFilter size={16} />
                <span className="hidden sm:inline">Filter</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Section</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={section}
                onValueChange={(value) => {
                  setSection(value);
                  setIndex(0);
                }}
              >
                <DropdownMenuRadioItem value="all">
                  All sections
                </DropdownMenuRadioItem>
                {[
                  ...new Set(
                    questions.map(
                      (question) =>
                        question.module ||
                        domainNames[question.domain] ||
                        question.domain,
                    ),
                  ),
                ].map((item) => (
                  <DropdownMenuRadioItem key={item} value={item}>
                    {item}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Answers</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setIndex(0);
                }}
              >
                <DropdownMenuRadioItem value="all">
                  All questions
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="incorrect">
                  Mistakes
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="correct">
                  Correct
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="unanswered">
                  Unanswered
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="marked">
                  Marked for review
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <PracticeResultsActions
            title={title}
            sessionId={sessionId}
            questions={questions}
            loading={loading}
            compact
          />
        </div>
      </header>
      <div className="teacher-review-scroll">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm font-medium">
            Question {filtered.length ? index + 1 : 0} of {filtered.length}
            {q && ` · ${domainNames[q.domain] || q.domain}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              onClick={() => setShowAnswers(!showAnswers)}
            >
              {showAnswers ? "Hide answers" : "Show answers"}
            </button>
            <select
              aria-label="Review text size"
              className={button}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              <option value={100}>Text 100%</option>
              <option value={125}>Text 125%</option>
              <option value={150}>Text 150%</option>
            </select>
            <WhiteboardButton
              questions={filtered}
              title={title}
              boardKey={`${sessionId}:set`}
              showSolutions
              label="Question set → whiteboard"
            />
          </div>
        </div>
        {q ? (
          <>
            <AssessmentWorkspaceActions
              sessionId={sessionId}
              question={q}
              questions={questions}
              title={title}
              showSolutions
            />
            <div
              className={`assessment-question-grid mt-6 ${hasAssessmentContent(detail?.stimulus) ? "" : "assessment-question-centered"}`}
              style={{ fontSize: `${zoom}%` }}
            >
              {hasAssessmentContent(detail?.stimulus) && (
                <div className="rounded-xl border p-6">
                  <AnnotatedPassage
                    questionId={`${sessionId}:${q.id}:review-stimulus`}
                    html={detail?.stimulus || ""}
                  />
                </div>
              )}
              <div className="assessment-question space-y-5">
                {detail ? (
                  <>
                    <AnnotatedPassage
                      questionId={`${sessionId}:${q.id}:review-stem`}
                      html={detail.stem}
                    />
                    {detail.answerOptions ? (
                      <AssessmentAnswerOptions
                        options={detail.answerOptions}
                        selected={showAnswers ? q.answer : undefined}
                        onSelect={() => {}}
                        disabled
                        checked={showAnswers}
                        correctAnswers={detail.correct_answer}
                      />
                    ) : (
                      <AssessmentAnswerInput
                        value={showAnswers ? q.answer : ""}
                        onChange={() => {}}
                        disabled
                        checked={showAnswers}
                        correct={isCorrectAnswer(
                          q.answer,
                          detail.correct_answer,
                        )}
                      />
                    )}
                    {!detail.answerOptions && (
                      <div className="rounded-xl border p-4 text-sm">
                        <p>
                          <strong>Student answer:</strong>{" "}
                          {showAnswers ? q.answer || "Unanswered" : "Hidden"}
                        </p>
                        {showAnswers && (
                          <p className="mt-2">
                            <strong>Correct answer:</strong>{" "}
                            {detail.correct_answer?.join(", ") || "Unavailable"}
                            {q.answer && known
                              ? isCorrectAnswer(q.answer, detail.correct_answer)
                                ? " · Correct"
                                : " · Incorrect"
                              : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p>
                    {loading
                      ? "Loading question…"
                      : "This question could not be loaded."}
                  </p>
                )}
              </div>
            </div>
            {showAnswers && detail && (
              <div className="mt-6">
                <AssessmentExplanation
                  html={detail.rationale}
                  questionId={q.id}
                />
              </div>
            )}
          </>
        ) : (
          <p className="my-8 rounded-xl border p-6">
            No questions match these filters.
          </p>
        )}
        {actions && <div className="mt-6 border-t pt-5">{actions}</div>}
      </div>
      <nav
        className="teacher-review-footer"
        aria-label="Review question navigation"
      >
        <button
          className={`${button} assessment-icon-button`}
          aria-label="Previous question"
          title="Previous question"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          <ArrowLeft size={18} />
        </button>
        <div
          className="teacher-review-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={filtered.length}
          aria-valuenow={filtered.length ? index + 1 : 0}
          aria-label="Review progress"
        >
          <div
            className="teacher-review-progress-fill"
            style={{
              width: `${filtered.length ? ((index + 1) / filtered.length) * 100 : 0}%`,
            }}
          />
          <span>
            {filtered.length ? index + 1 : 0} / {filtered.length}
          </span>
        </div>
        <button
          className={`${button} assessment-icon-button`}
          aria-label="Next question"
          title="Next question"
          disabled={index >= filtered.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          <ArrowRight size={18} />
        </button>
      </nav>
    </section>
  );
}
