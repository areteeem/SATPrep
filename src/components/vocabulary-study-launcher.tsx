"use client";
import { useEffect, useMemo, useState } from "react";
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
  embedded = false,
  initialWord,
}: {
  words: VocabularyWord[];
  embedded?: boolean;
  initialWord?: string;
}) {
  const [data, setData] = useResolvedPracticePerformanceData();
  const [scheduleState,setScheduleState]=useState<VocabularySchedule>({});
  useEffect(()=>setScheduleState(readVocabularySchedule()),[]);
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
    const due = items.filter((item) =>
      schedule[item.word]
        ? schedule[item.word].due <= now
        : Boolean(data.wordPerformance[item.word]),
    );
    const fresh = items
      .filter(
        (item) => !schedule[item.word] && !data.wordPerformance[item.word],
      )
      .slice(0, 20);
    const first = initialWord
      ? words.find(
          (item) => item.word.toLowerCase() === initialWord.toLowerCase(),
        )
      : undefined;
    const study = reviewOnly ? due : [...due, ...fresh];
    setQueue(
      (first
        ? [first, ...study.filter((item) => item.word !== first.word)]
        : study
      ).slice(0, 100),
    );
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
    setScheduleState(schedule);
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
  useEffect(() => {
    if (!open || !word) return;
    const handle = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest("input,textarea,select")) return;
      if (
        event.code === "Space" &&
        !revealed &&
        ["flashcards", "reverse"].includes(mode)
      ) {
        event.preventDefault();
        setRevealed(true);
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const rating = Number(event.key);
        grade(rating !== 1 && answerCorrect !== false, [0, 0, 1, 3, 7][rating]);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  const schedule = scheduleState;
  const dueCount = words.filter((item) =>
    schedule[item.word]
      ? schedule[item.word].due <= Date.now()
      : Boolean(data.wordPerformance[item.word]),
  ).length;
  const newCount = words.filter(
    (item) => !schedule[item.word] && !data.wordPerformance[item.word],
  ).length;
  const overview = (
    <section className="mx-auto w-full max-w-3xl rounded-xl border p-6">
      <h2 className="text-xl font-semibold">SAT Vocabulary</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Study new cards and reviews due today. Use Space to reveal, then 1–4 to
        rate your recall.
      </p>
      <div className="my-7 grid grid-cols-3 divide-x text-center">
        <div>
          <strong className="text-2xl">{newCount}</strong>
          <p className="mt-1 text-sm text-neutral-500">New</p>
        </div>
        <div>
          <strong className="text-2xl">{dueCount}</strong>
          <p className="mt-1 text-sm text-neutral-500">Due</p>
        </div>
        <div>
          <strong className="text-2xl">{words.length - newCount}</strong>
          <p className="mt-1 text-sm text-neutral-500">Studied</p>
        </div>
      </div>
      <button
        className={`${button} assessment-primary w-full`}
        disabled={!words.length}
        onClick={() => begin(false)}
      >
        Study now
      </button>
    </section>
  );
  const content = (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {review ? "Review" : "SAT Vocabulary"}
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            {word
              ? `${index + 1} / ${queue.length} cards · ${score} remembered`
              : `${score} remembered out of ${queue.length}`}
          </p>
        </div>
        <button className={button} onClick={() => setOpen(false)}>
          Deck overview
        </button>
      </div>
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
                <button className={`${button} mt-3`} disabled={!answer.trim()}>
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
                  1 · Again · 1 min
                </button>
                <button
                  className={button}
                  onClick={() => grade(answerCorrect !== false, 1)}
                >
                  2 · Hard · 1 day
                </button>
                <button
                  className={button}
                  onClick={() => grade(answerCorrect !== false, 3)}
                >
                  3 · Good · 3 days
                </button>
                <button
                  className={button}
                  onClick={() => grade(answerCorrect !== false, 7)}
                >
                  4 · Easy · 7 days
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
    </>
  );
  if (embedded)
    return (
      <div className="mx-auto w-full max-w-3xl">
        {open ? (
          <section className="rounded-xl border p-5 sm:p-8">{content}</section>
        ) : (
          overview
        )}
      </div>
    );
  return (
    <>
      <button
        className={button}
        onClick={() => begin(false)}
        disabled={!words.length}
      >
        <BookOpen size={16} />
        Study vocabulary
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-y-auto">
          <DialogTitle className="sr-only">SAT Vocabulary</DialogTitle>
          <DialogDescription className="sr-only">
            Review due and new flashcards.
          </DialogDescription>
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
}
