"use client";
import {
  DatabaseIcon,
  Search,
  BookOpen,
  Play,
  Activity,
  Flame,
} from "lucide-react";
import React, { useReducer, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardTitle,
} from "@/components/ui/card-v2";
import { cn } from "@/lib/utils";
import { vocabs_database } from "@/types/vocabulary";
import { partOfSpeechType } from "@/types/dictionaryapi";
import Link from "next/link";
import {
  VocabularyStudyLauncher,
  readVocabularySchedule,
} from "@/components/vocabulary-study-launcher";
import {
  useResolvedVocabsData,
  useResolvedPracticePerformanceData,
} from "@/hooks/use-resolved-user-data";

// Search and Filter reducer
type SearchState = {
  query: string;
  difficultyFilter: "all" | "easy" | "medium" | "hard";
  partOfSpeechFilter: "all" | partOfSpeechType;
  masteryFilter:
    | "all"
    | "struggling"
    | "learning"
    | "proficient"
    | "mastered"
    | "not-practiced";
};

type SearchAction =
  | { type: "SET_QUERY"; payload: string }
  | {
      type: "SET_DIFFICULTY_FILTER";
      payload: "all" | "easy" | "medium" | "hard";
    }
  | { type: "SET_PART_OF_SPEECH_FILTER"; payload: "all" | partOfSpeechType }
  | {
      type: "SET_MASTERY_FILTER";
      payload:
        | "all"
        | "struggling"
        | "learning"
        | "proficient"
        | "mastered"
        | "not-practiced";
    };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "SET_QUERY":
      return { ...state, query: action.payload };
    case "SET_DIFFICULTY_FILTER":
      return { ...state, difficultyFilter: action.payload };
    case "SET_PART_OF_SPEECH_FILTER":
      return { ...state, partOfSpeechFilter: action.payload };
    case "SET_MASTERY_FILTER":
      return { ...state, masteryFilter: action.payload };
    default:
      return state;
  }
}

export default function VocabsMainPage() {
  const [searchState, dispatch] = useReducer(searchReducer, {
    query: "",
    difficultyFilter: "all",
    partOfSpeechFilter: "all",
    masteryFilter: "all",
  });

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [learnedFilter, setLearnedFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("alphabetical");
  const categories = useMemo(
    () =>
      [
        ...new Set(vocabs_database.flatMap((word) => word.categories || [])),
      ].sort(),
    [],
  );
  const [vocabsData] = useResolvedVocabsData();

  // practicePerformanceData — authenticated users read from Redux (cloud),
  // unauthenticated users fall back to localStorage.
  const [practiceData] = useResolvedPracticePerformanceData();

  // Calculate vocabulary statistics
  const vocabStats = useMemo(() => {
    const learntVocabsSet = new Set(vocabsData.learntVocabs);
    const wordsWithSentences = Object.keys(vocabsData.userSentences);

    // Count total sentences across all words
    const totalSentences = Object.values(vocabsData.userSentences).reduce(
      (sum, sentences) => sum + sentences.length,
      0,
    );

    // Calculate difficulty distribution
    const totalByDifficulty = vocabs_database.reduce(
      (acc, vocab) => {
        acc[vocab.difficulty] = (acc[vocab.difficulty] || 0) + 1;
        return acc;
      },
      {} as Record<"easy" | "medium" | "hard", number>,
    );

    // Calculate learned words by difficulty
    const learnedByDifficulty = vocabs_database.reduce(
      (acc, vocab) => {
        if (learntVocabsSet.has(vocab.word)) {
          acc[vocab.difficulty] = (acc[vocab.difficulty] || 0) + 1;
        }
        return acc;
      },
      {} as Record<"easy" | "medium" | "hard", number>,
    );

    // Calculate mastery level distribution
    const masteryStats = {
      struggling: 0,
      learning: 0,
      proficient: 0,
      mastered: 0,
      notPracticed: 0,
    };

    vocabs_database.forEach((vocab) => {
      const wordPerformance = practiceData.wordPerformance[vocab.word];
      if (wordPerformance) {
        masteryStats[wordPerformance.masteryLevel]++;
      } else {
        masteryStats.notPracticed++;
      }
    });

    // Calculate statistics for each difficulty
    const difficultyStats = Object.entries(totalByDifficulty).map(
      ([difficulty, total]) => {
        const learned =
          learnedByDifficulty[difficulty as keyof typeof learnedByDifficulty] ||
          0;
        const percentage = total > 0 ? Math.round((learned / total) * 100) : 0;

        return {
          difficulty: difficulty as "easy" | "medium" | "hard",
          label: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
          total,
          learned,
          percentage,
          remaining: total - learned,
        };
      },
    );

    const totalWords = vocabs_database.length;
    const totalLearned = vocabsData.learntVocabs.length;
    const overallPercentage =
      totalWords > 0 ? Math.round((totalLearned / totalWords) * 100) : 0;

    return {
      totalWords,
      totalLearned,
      totalSentences,
      wordsWithSentences: wordsWithSentences.length,
      overallPercentage,
      difficultyStats,
      masteryStats,
      remaining: totalWords - totalLearned,
    };
  }, [vocabsData, practiceData.wordPerformance]);

  // Filter vocabularies based on search query, difficulty, part of speech, and mastery level
  const filteredVocabs = useMemo(() => {
    let filtered = vocabs_database;

    // Filter by search query
    if (searchState.query.trim()) {
      const query = searchState.query.toLowerCase();
      filtered = filtered.filter(
        (vocab) =>
          vocab.word.toLowerCase().includes(query) ||
          vocab.definition.toLowerCase().includes(query),
      );
    }

    // Filter by difficulty
    if (searchState.difficultyFilter !== "all") {
      filtered = filtered.filter((vocab) => {
        return vocab.difficulty === searchState.difficultyFilter;
      });
    }

    // Filter by part of speech
    if (searchState.partOfSpeechFilter !== "all") {
      filtered = filtered.filter((vocab) => {
        return vocab.part_of_speech === searchState.partOfSpeechFilter;
      });
    }

    // Filter by mastery level
    if (searchState.masteryFilter !== "all") {
      filtered = filtered.filter((vocab) => {
        const wordPerformance = practiceData.wordPerformance[vocab.word];

        if (searchState.masteryFilter === "not-practiced") {
          return !wordPerformance;
        }

        if (!wordPerformance) {
          return false;
        }

        return wordPerformance.masteryLevel === searchState.masteryFilter;
      });
    }

    if (categoryFilter !== "all")
      filtered = filtered.filter((word) =>
        word.categories?.includes(categoryFilter),
      );
    if (learnedFilter !== "all")
      filtered = filtered.filter(
        (word) =>
          vocabsData.learntVocabs.includes(word.word) ===
          (learnedFilter === "learned"),
      );
    const schedule = readVocabularySchedule();
    if (reviewFilter !== "all")
      filtered = filtered.filter((word) => {
        const performance = practiceData.wordPerformance[word.word];
        return reviewFilter === "due"
          ? schedule[word.word]
            ? schedule[word.word].due <= Date.now()
            : Boolean(performance)
          : reviewFilter === "mistakes"
            ? Boolean(performance?.incorrectAttempts)
            : !performance;
      });
    return [...filtered].sort((a, b) =>
      sortOrder === "recent"
        ? (practiceData.wordPerformance[b.word]?.lastAttemptTimestamp || 0) -
          (practiceData.wordPerformance[a.word]?.lastAttemptTimestamp || 0)
        : sortOrder === "mistakes"
          ? (practiceData.wordPerformance[b.word]?.incorrectAttempts || 0) -
            (practiceData.wordPerformance[a.word]?.incorrectAttempts || 0)
          : a.word.localeCompare(b.word),
    );
  }, [
    categoryFilter,
    learnedFilter,
    reviewFilter,
    sortOrder,
    vocabsData.learntVocabs,
    searchState.query,
    searchState.difficultyFilter,
    searchState.partOfSpeechFilter,
    searchState.masteryFilter,
    practiceData.wordPerformance,
  ]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_QUERY", payload: e.target.value });
  };

  const handleDifficultyFilterChange = (
    difficulty: "all" | "easy" | "medium" | "hard",
  ) => {
    dispatch({ type: "SET_DIFFICULTY_FILTER", payload: difficulty });
  };

  const handlePartOfSpeechFilterChange = (
    partOfSpeech: "all" | partOfSpeechType,
  ) => {
    dispatch({ type: "SET_PART_OF_SPEECH_FILTER", payload: partOfSpeech });
  };

  const handleMasteryFilterChange = (
    masteryLevel:
      | "all"
      | "struggling"
      | "learning"
      | "proficient"
      | "mastered"
      | "not-practiced",
  ) => {
    dispatch({ type: "SET_MASTERY_FILTER", payload: masteryLevel });
  };

  return (
    <React.Fragment>
      <h3 className="text-3xl font-bold Tracker flex  items-center mb-6 gap-2">
        <DatabaseIcon className="text-2xl text-neutral-500" /> SAT Vocabulary
        Wordbank
      </h3>

      <div className="w-full grid grid-cols-9 gap-6">
        <div className="col-span-12 xl:col-span-3 ">
          <div className="sticky top-16">
            <Card
              variant="accent"
              className={cn("rounded-3xl", "transition-all duration-300")}
            >
              <CardHeader>
                <CardHeading>
                  <CardTitle>
                    <div className="flex items-center gap-2">Your Progress</div>
                  </CardTitle>
                </CardHeading>
              </CardHeader>

              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Overall Progress */}
                  <div className="space-y-4">
                    <div className="flex flex-row items-center justify-between">
                      <h3 className="text-lg font-medium">Overall Progress</h3>
                      <div className="text-lg font-bold text-foreground">
                        {vocabStats.overallPercentage}%
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2 mb-4">
                      <div
                        className="bg-neutral-600 rounded-full h-2 transition-all duration-300"
                        style={{
                          width: `${vocabStats.overallPercentage}%`,
                        }}
                      />
                    </div>

                    {/* Learned/Total Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-4 text-center border-border bg-card">
                        <div className="text-sm text-muted-foreground mb-1">
                          Learned
                        </div>
                        <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-400">
                          {vocabStats.totalLearned}
                        </div>
                      </Card>

                      <Card className="p-4 text-center border-border bg-card">
                        <div className="text-sm text-muted-foreground mb-1">
                          Remaining
                        </div>
                        <div className="text-2xl font-bold text-neutral-600 dark:text-neutral-400">
                          {vocabStats.remaining}
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Difficulty Breakdown */}
                  <div className="space-y-4 border-t border-border pt-4">
                    <h3 className="text-lg font-semibold">
                      Difficulty Breakdown
                    </h3>
                    {vocabStats.difficultyStats.map(
                      ({ difficulty, label, total, learned, percentage }) => (
                        <div key={difficulty} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3 h-3 rounded-full ${
                                  difficulty === "easy"
                                    ? "bg-neutral-500"
                                    : difficulty === "medium"
                                      ? "bg-neutral-500"
                                      : "bg-neutral-500"
                                }`}
                              />
                              <span className="text-sm font-medium">
                                {label}
                              </span>
                            </div>
                            <span className="text-xs font-medium">
                              {learned}/{total} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`rounded-full h-2 transition-all duration-300 ${
                                difficulty === "easy"
                                  ? "bg-neutral-500"
                                  : difficulty === "medium"
                                    ? "bg-neutral-500"
                                    : "bg-neutral-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Mastery Level Breakdown */}
                  <div className="space-y-4 border-t border-border pt-4">
                    <h3 className="text-lg font-semibold">
                      Mastery Level Breakdown
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-950/40 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-neutral-500 rounded-full"></span>
                          <span>Struggling</span>
                        </div>
                        <span className="font-semibold">
                          {vocabStats.masteryStats.struggling}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-950/40 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-neutral-500 rounded-full"></span>
                          <span>Learning</span>
                        </div>
                        <span className="font-semibold">
                          {vocabStats.masteryStats.learning}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-950/40 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-neutral-500 rounded-full"></span>
                          <span>Proficient</span>
                        </div>
                        <span className="font-semibold">
                          {vocabStats.masteryStats.proficient}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-950/40 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-neutral-500 rounded-full"></span>
                          <span>Mastered</span>
                        </div>
                        <span className="font-semibold">
                          {vocabStats.masteryStats.mastered}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full"></span>
                        <span>Not Practiced</span>
                      </div>
                      <span className="font-semibold">
                        {vocabStats.masteryStats.notPracticed}
                      </span>
                    </div>
                  </div>

                  {/* Practice Statistics */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {vocabStats.wordsWithSentences}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Words Practiced
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {vocabStats.totalSentences}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total Sentences
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA Card for Learning - Duolingo Style */}
            <Card
              className={cn(
                "vocab-study-cta rounded-xl mt-6 border border-neutral-700 bg-neutral-950 text-white",
                "transition-all duration-300 hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-700 hover:scale-[1.02]",
              )}
            >
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-neutral-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <BookOpen className="text-white w-8 h-8" />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">
                    Practice every word individually
                  </h3>

                  <p className="text-muted-foreground text-sm mb-6">
                    Master all {vocabs_database.length} SAT vocabulary words
                    with bite-sized lessons
                  </p>

                  <Link href={"/dashboard/vocabs/learn"}>
                    <button className="w-full bg-gradient-to-b from-neutral-400 to-neutral-500 hover:from-neutral-500 hover:to-neutral-600 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-150 flex items-center justify-center gap-3 shadow-[0_4px_0_0_theme(colors.blue.600),0_8px_20px_theme(colors.blue.500/0.25)] hover:shadow-[0_6px_0_0_theme(colors.blue.700),0_10px_25px_theme(colors.blue.500/0.3)] active:shadow-[0_2px_0_0_theme(colors.blue.600),0_4px_10px_theme(colors.blue.500/0.2)] active:translate-y-0.5 transform active:scale-95">
                      <Play className="w-5 h-5" />
                      START LEARNING
                    </button>
                  </Link>

                  <p className="text-xs text-muted-foreground mt-3">
                    <Flame size={14} className="mr-1 inline" /> Keep your streak
                    alive! Start today
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-6">
          <div className="relative w-full mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search words and definitions..."
              value={searchState.query}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Difficulty Filter */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-foreground mb-2">
              Difficulty Level
            </h5>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDifficultyFilterChange("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.difficultyFilter === "all"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                All
              </button>
              <button
                onClick={() => handleDifficultyFilterChange("easy")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.difficultyFilter === "easy"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Easy
              </button>
              <button
                onClick={() => handleDifficultyFilterChange("medium")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.difficultyFilter === "medium"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Medium
              </button>
              <button
                onClick={() => handleDifficultyFilterChange("hard")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.difficultyFilter === "hard"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Hard
              </button>
            </div>
          </div>

          {/* Part of Speech Filter */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-foreground mb-2">
              Part of Speech
            </h5>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handlePartOfSpeechFilterChange("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.partOfSpeechFilter === "all"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                All
              </button>
              <button
                onClick={() => handlePartOfSpeechFilterChange("noun")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.partOfSpeechFilter === "noun"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Noun
              </button>
              <button
                onClick={() => handlePartOfSpeechFilterChange("verb")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.partOfSpeechFilter === "verb"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Verb
              </button>
              <button
                onClick={() => handlePartOfSpeechFilterChange("adjective")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.partOfSpeechFilter === "adjective"
                    ? "bg-pink-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Adjective
              </button>
              <button
                onClick={() => handlePartOfSpeechFilterChange("adverb")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.partOfSpeechFilter === "adverb"
                    ? "bg-teal-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Adverb
              </button>
            </div>
          </div>

          {/* Mastery Level Filter */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-foreground mb-2">
              Mastery Level
            </h5>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleMasteryFilterChange("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.masteryFilter === "all"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                All
              </button>
              <button
                onClick={() => handleMasteryFilterChange("not-practiced")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.masteryFilter === "not-practiced"
                    ? "bg-secondary-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Not Practiced
              </button>
              <button
                onClick={() => handleMasteryFilterChange("struggling")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.masteryFilter === "struggling"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Struggling
              </button>
              <button
                onClick={() => handleMasteryFilterChange("learning")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.masteryFilter === "learning"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Learning
              </button>
              <button
                onClick={() => handleMasteryFilterChange("proficient")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.masteryFilter === "proficient"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Proficient
              </button>
              <button
                onClick={() => handleMasteryFilterChange("mastered")}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  searchState.masteryFilter === "mastered"
                    ? "bg-neutral-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                Mastered
              </button>
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Category
              <select
                className="mt-2 block w-full rounded-xl border bg-background p-2"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Learning status
              <select
                className="mt-2 block w-full rounded-xl border bg-background p-2"
                value={learnedFilter}
                onChange={(e) => setLearnedFilter(e.target.value)}
              >
                <option value="all">All words</option>
                <option value="learned">Learned</option>
                <option value="new">Not learned</option>
              </select>
            </label>
            <label className="text-sm">
              Review queue
              <select
                className="mt-2 block w-full rounded-xl border bg-background p-2"
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
              >
                <option value="all">All words</option>
                <option value="due">Due for review</option>
                <option value="mistakes">Previous mistakes</option>
                <option value="new">Never practiced</option>
              </select>
            </label>
            <label className="text-sm">
              Sort words
              <select
                className="mt-2 block w-full rounded-xl border bg-background p-2"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="alphabetical">Alphabetical</option>
                <option value="recent">Recently practiced</option>
                <option value="mistakes">Most mistakes first</option>
              </select>
            </label>
          </div>
          <div className="mb-5">
            <VocabularyStudyLauncher words={filteredVocabs} />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredVocabs.length} of {vocabs_database.length} words
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVocabs.map((vocab, index) => {
              const wordPerformance = practiceData.wordPerformance[vocab.word];
              const masteryLevel = wordPerformance?.masteryLevel;

              return (
                <Link
                  href={`/dashboard/vocabs/learn?word=${vocab.word}`}
                  key={index}
                >
                  <div
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md",
                      masteryLevel === "mastered" &&
                        "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30",
                      masteryLevel === "proficient" &&
                        "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30",
                      masteryLevel === "learning" &&
                        "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30",
                      masteryLevel === "struggling" &&
                        "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30",
                      !masteryLevel && "border-border bg-card",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-lg">{vocab.word}</h4>
                      {masteryLevel && (
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-full font-medium",
                            masteryLevel === "mastered" &&
                              "bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200",
                            masteryLevel === "proficient" &&
                              "bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200",
                            masteryLevel === "learning" &&
                              "bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200",
                            masteryLevel === "struggling" &&
                              "bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200",
                          )}
                        >
                          {masteryLevel.charAt(0).toUpperCase() +
                            masteryLevel.slice(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm opacity-75 line-clamp-2 mb-2">
                      {vocab.definition}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {vocab.part_of_speech}
                      </p>
                      {wordPerformance && (
                        <div className="text-xs text-muted-foreground">
                          {wordPerformance.correctAttempts}/
                          {wordPerformance.totalAttempts} correct
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
