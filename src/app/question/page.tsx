"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { assessmentButton } from "@/components/assessment-controls";

export default function QuestionSearchQueryPage() {
  const [questionId, setQuestionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = questionId.trim();
    if (!id) return;
    setIsLoading(true);
    router.push(`/question/${encodeURIComponent(id)}`);
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-neutral-500">
            SAT question bank
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Search by question ID
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-500 sm:text-base">
            Enter a College Board question ID to open the question.
          </p>
        </header>

        <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <div className="rounded-[1.25rem] border border-neutral-100 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-7">
            <form onSubmit={handleSearch}>
              <label
                htmlFor="question-id"
                className="mb-2 block text-sm font-medium"
              >
                Question ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="question-id"
                  type="text"
                  placeholder="e.g. bd9eb2b5"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:ring-neutral-800"
                  value={questionId}
                  onChange={(event) => setQuestionId(event.target.value)}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!questionId.trim() || isLoading}
                  className={`${assessmentButton} shrink-0 rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:hover:bg-neutral-900 dark:border-neutral-600 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200`}
                >
                  <Search size={16} />
                  {isLoading ? "Searching…" : "Search"}
                </button>
              </div>
            </form>

          </div>
        </section>
      </div>
    </main>
  );
}
