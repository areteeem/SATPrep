"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { VocabularyStudyLauncher } from "@/components/vocabulary-study-launcher";
import { vocabs_database } from "@/types/vocabulary";
import { assessmentButton as button } from "@/components/assessment-controls";
export default function LearnVocab() {
  const [difficulty, setDifficulty] = useState("all"),
    [search, setSearch] = useState("");
  const params = useSearchParams();
  const words = useMemo(
    () =>
      vocabs_database.filter(
        (w) =>
          (difficulty === "all" || w.difficulty === difficulty) &&
          (!search ||
            `${w.word} ${w.definition}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [difficulty, search],
  );
  return (
    <main className="mx-auto min-h-dvh max-w-5xl space-y-6 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/vocabs" className="text-sm text-neutral-500">
            ← Vocabulary library
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">Vocabulary decks</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="Filter vocabulary deck"
            placeholder="Find a word…"
            className="rounded-xl border bg-transparent p-3 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Deck difficulty"
            className={button}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </header>
      <VocabularyStudyLauncher
        key={`${difficulty}:${search}`}
        words={words}
        embedded
        initialWord={params.get("word") || undefined}
      />
    </main>
  );
}
