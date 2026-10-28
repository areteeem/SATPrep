"use client";
import { useMemo, useState } from "react";
import { BookOpen, Brain, Check, ListChecks, RotateCcw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assessmentButton as button } from "@/components/assessment-controls";
import { useResolvedPracticePerformanceData } from "@/hooks/use-resolved-user-data";
import type { VocabularyWord, WordPerformance } from "@/types/vocabulary";

export const VOCAB_REVIEW_KEY = "sat-vocab-review-v1";
export type VocabularySchedule = Record<
  string,
  { due: number; interval: number }
>;
export function readVocabularySchedule(): VocabularySchedule {
  try {
    return JSON.parse(localStorage.getItem(VOCAB_REVIEW_KEY) || "{}");
  } catch {
    return {};
  }
}
type Mode = "flashcards" | "reverse" | "recall" | "choice";
export function VocabularyStudyLauncher({
  words,
}: {
  words: VocabularyWord[];
}) {
  const [data, setData] = useResolvedPracticePerformanceData();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<Mode>("flashcards"),
    [queue, setQueue] = useState<VocabularyWord[]>([]),
    [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [answer, setAnswer] = useState(""),
    [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null),
    [score, setScore] = useState(0),
    [review, setReview] = useState(false);
  const word = queue[index];
  const options = useMemo(
    () =>
      word
        ? [
            ...words
              .filter((item) => item.word !== word.word)
              .slice(
                index % Math.max(1, words.length - 3),
                (index % Math.max(1, words.length - 3)) + 3,
              ),
            word,
          ].sort((a, b) => a.word.localeCompare(b.word))
        : [],
    [word, words, index],
  );
  const begin = (reviewOnly: boolean) => {
    const schedule = readVocabularySchedule(),
      now = Date.now();
    const items = words
      .filter(
        (item) =>
          !reviewOnly ||
          (schedule[item.word]
            ? schedule[item.word].due <= now
            : Boolean(data.wordPerformance[item.word])),
      )
      .sort((a, b) =>
        reviewOnly
          ? (schedule[a.word]?.due || 0) - (schedule[b.word]?.due || 0)
          : 0,
      );
    setQueue(items.slice(0, 50));
    setReview(reviewOnly);
    setIndex(0);
    setScore(0);
    setRevealed(false);
    setAnswer("");
    setAnswerCorrect(null);
    setOpen(true);
  };
  const resetCard = () => {
    setRevealed(false);
    setAnswer("");
    setAnswerCorrect(null);
  };
  const grade = (correct: boolean, days: number) => {
    if (!word) return;
    const now = Date.now();
    const schedule = readVocabularySchedule();
    schedule[word.word] = {
      due: now + (correct ? days * 86400000 : 60000),
      interval: correct ? days : 0,
    };
    try {
      localStorage.setItem(VOCAB_REVIEW_KEY, JSON.stringify(schedule));
    } catch {}
    setData((previous) => {
      const old = previous.wordPerformance[word.word];
      const consecutive = correct ? (old?.consecutiveCorrect || 0) + 1 : 0;
      const performance: WordPerformance = {
        word: word.word,
        totalAttempts: (old?.totalAttempts || 0) + 1,
        correctAttempts: (old?.correctAttempts || 0) + (correct ? 1 : 0),
        incorrectAttempts: (old?.incorrectAttempts || 0) + (correct ? 0 : 1),
        lastAttemptTimestamp: now,
        averageTimeSpent: old?.averageTimeSpent || 0,
        strugglingAreas: correct
          ? old?.strugglingAreas || []
          : ["definition-quiz"],
        masteryLevel: correct
          ? consecutive >= 5
            ? "mastered"
            : consecutive >= 3
              ? "proficient"
              : "learning"
          : "struggling",
        consecutiveCorrect: consecutive,
        consecutiveIncorrect: correct
          ? 0
          : (old?.consecutiveIncorrect || 0) + 1,
      };
      const performances = {
        ...previous.wordPerformance,
        [word.word]: performance,
      };
      const attempts = [
        ...previous.attempts,
        {
          word: word.word,
          questionType: "definition-quiz" as const,
          isCorrect: correct,
          userAnswer: answer || String(correct ? "remembered" : "again"),
          correctAnswer: word.word,
          timestamp: now,
          difficulty: word.difficulty,
        },
      ];
      return {
        ...previous,
        attempts,
        wordPerformance: performances,
        lastUpdated: now,
        totalQuizzesTaken: previous.totalQuizzesTaken + 1,
        overallAccuracy: Math.round(
          (attempts.filter((attempt) => attempt.isCorrect).length /
            attempts.length) *
            100,
        ),
        strongWords: Object.values(performances)
          .filter((item) =>
            ["mastered", "proficient"].includes(item.masteryLevel),
          )
          .map((item) => item.word),
        weakWords: Object.values(performances)
          .filter((item) => item.masteryLevel === "struggling")
          .map((item) => item.word),
      };
    });
    if (correct) setScore(score + 1);
    setIndex(index + 1);
    resetCard();
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={!words.length}
          onClick={() => begin(false)}
        >
          <BookOpen size={16} />
          Study filtered words
        </button>
        <button className={button} onClick={() => begin(true)}>
          <RotateCcw size={16} />
          Review due words
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {review ? "Vocabulary review" : "Vocabulary study"}
            </DialogTitle>
            <DialogDescription>
              {word
                ? `${index + 1} of ${queue.length} · ${mode === "recall" ? "Recall the word from its definition" : "Choose a study mode"}`
                : `${score} remembered out of ${queue.length}. Review ratings set the next due date.`}
            </DialogDescription>
          </DialogHeader>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Vocabulary study mode"
          >
            {[
              {
                value: "flashcards" as const,
                label: "Flashcards",
                Icon: BookOpen,
              },
              { value: "reverse" as const, label: "Reverse", Icon: RotateCcw },
              {
                value: "recall" as const,
                label: "Written recall",
                Icon: Brain,
              },
              {
                value: "choice" as const,
                label: "Multiple choice",
                Icon: ListChecks,
              },
            ].map(({ value, label, Icon }) => (
              <button
                className={`${button} ${mode === value ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
                key={value}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  resetCard();
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          {word ? (
            <>
              <div className="my-3 rounded-xl border border-neutral-200 p-7 text-center dark:border-neutral-700">
                <p className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
                  {mode === "flashcards" ? "Word" : "Definition"}
                </p>
                <h2 className="text-2xl font-semibold">
                  {mode === "flashcards" ? word.word : word.definition}
                </h2>
                {revealed && (
                  <div className="mt-6 border-t pt-5">
                    <p className="text-xl">
                      {mode === "flashcards" ? word.definition : word.word}
                    </p>
                    <p className="mt-2 text-sm text-neutral-500">
                      {word.part_of_speech}
                    </p>
                    {word.example && (
                      <p className="mt-4 text-sm italic">{word.example}</p>
                    )}
                  </div>
                )}
              </div>
              {mode === "recall" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAnswerCorrect(
                      answer.trim().toLowerCase() === word.word.toLowerCase(),
                    );
                    setRevealed(true);
                  }}
                >
                  <input
                    aria-label="Recall vocabulary word"
                    className="w-full rounded-xl border bg-transparent p-3"
                    disabled={revealed}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type the word"
                  />
                  {!revealed && (
                    <button
                      className={`${button} mt-3`}
                      disabled={!answer.trim()}
                    >
                      Check recall
                    </button>
                  )}
                </form>
              )}
              {mode === "choice" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((option) => (
                    <button
                      key={option.word}
                      disabled={revealed}
                      className={button}
                      onClick={() => {
                        setAnswer(option.word);
                        setAnswerCorrect(option.word === word.word);
                        setRevealed(true);
                      }}
                    >
                      {option.word}
                    </button>
                  ))}
                </div>
              )}
              {!revealed && ["flashcards", "reverse"].includes(mode) && (
                <button className={button} onClick={() => setRevealed(true)}>
                  Show answer
                </button>
              )}
              {revealed && (
                <>
                  <p className="flex items-center justify-center gap-2 text-sm">
                    {answerCorrect === null ? (
                      "How well did you remember?"
                    ) : answerCorrect ? (
                      <>
                        <Check size={17} />
                        Correct
                      </>
                    ) : (
                      <>
                        <X size={17} />
                        Review this word again
                      </>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button className={button} onClick={() => grade(false, 0)}>
                      Again · 1 min
                    </button>
                    <button
                      className={button}
                      onClick={() => grade(answerCorrect !== false, 1)}
                    >
                      Hard · 1 day
                    </button>
                    <button
                      className={button}
                      onClick={() => grade(answerCorrect !== false, 3)}
                    >
                      Good · 3 days
                    </button>
                    <button
                      className={button}
                      onClick={() => grade(answerCorrect !== false, 7)}
                    >
                      Easy · 7 days
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="rounded-xl border p-6 text-center">
              {queue.length
                ? "Session complete. Your progress and next review dates are saved."
                : "No words are due in this selection. Study words first or change your filters."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
