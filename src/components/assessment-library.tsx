"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Presentation, Search } from "lucide-react";
import { readLocalAssessments } from "@/lib/local-assessments";
import type { LocalAssessment } from "@/lib/local-assessments";
import { domainNames, openWhiteboard, readWhiteboards } from "@/lib/assessment-workspace";
import type { WhiteboardDocument, WorkspaceQuestion } from "@/lib/assessment-workspace";
import { assessmentButton as button } from "@/components/assessment-controls";

const pageSize = 24;
type QuestionEntry = {
  question: WorkspaceQuestion;
  source: string;
  date: string;
  kind: string;
  sessionId?: string;
  boardId?: string;
};
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}
function textOnly(html = "") {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll(".sr-only, script, style").forEach((element) => element.remove());
  return document.body.textContent?.replace(/\s+/g, " ").trim() || "";
}
function boardKind(board: WhiteboardDocument) {
  if (/assign/i.test(board.title)) return "assigned";
  if (/full.length|full.test/i.test(board.title)) return "full";
  if (/rush/i.test(board.title)) return "rush";
  return "review";
}
const kindLabels: Record<string, string> = {
  full: "Full-length test", rush: "Practice Rush", assigned: "Assigned practice", review: "Review",
};

export function AssessmentLibrary({ mode }: { mode: "boards" | "questions" }) {
  const [boards, setBoards] = useState<WhiteboardDocument[]>([]);
  const [sessions, setSessions] = useState<LocalAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  useEffect(() => {
    let alive = true;
    const reload = () => {
      setSessions(readLocalAssessments());
      void readWhiteboards().then((saved) => {
        if (alive) { setBoards(saved); setError(""); }
      }).catch(() => {
        if (alive) setError("Saved whiteboards could not be read. Check that browser storage is available.");
      }).finally(() => { if (alive) setLoading(false); });
    };
    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("storage", reload);
    return () => {
      alive = false;
      window.removeEventListener("focus", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);
  const questions = useMemo(() => {
    const entries: QuestionEntry[] = sessions.flatMap((session) => session.questions.map((question) => ({
      question,
      source: session.title,
      date: session.updatedAt || session.startedAt,
      kind: session.assignmentToken || (session.fullTest as { assignmentToken?: string } | undefined)?.assignmentToken || session.kind === "custom" ? "assigned" : session.kind,
      sessionId: session.id,
    })));
    for (const board of boards) {
      for (const question of board.questions) {
        entries.push({ question, source: board.title, date: board.updatedAt || board.createdAt, kind: boardKind(board), boardId: board.id });
      }
    }
    return entries.map((entry) => ({ ...entry, preview: textOnly(entry.question.detail?.stimulus || entry.question.detail?.stem || "") }));
  }, [sessions, boards]);
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    const items = mode === "boards"
      ? boards.map((board) => ({ id: board.id, title: board.title, date: board.updatedAt || board.createdAt, kind: boardKind(board), board }))
      : questions.map((entry, index) => ({ id: `${entry.sessionId || entry.boardId}:${entry.question.id}:${index}`, title: `${entry.question.externalId || entry.question.id} ${entry.preview} ${entry.source} ${domainNames[entry.question.domain] || entry.question.domain}`, date: entry.date, kind: entry.kind, entry }));
    return items.filter((item) => (kind === "all" || item.kind === kind) && (!query || item.title.toLowerCase().includes(query))).sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const delta = (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);
      return sort === "oldest" ? -delta : delta;
    });
  }, [mode, boards, questions, search, kind, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const openQuestion = (entry: QuestionEntry) => {
    setError("");
    void openWhiteboard(`${entry.source} · Question`, [entry.question], false, `history:${entry.sessionId}:${entry.question.id}`).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not open the whiteboard."));
  };
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 text-neutral-950 dark:text-white">
      <Link href="/" className="inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} />Home</Link>
      <h1 className="mt-6 text-3xl font-semibold">{mode === "boards" ? "Saved Whiteboards" : "Previous Questions"}</h1>
      <p className="mt-2 text-sm text-neutral-500">Saved on this device from reviews, Practice Rushes, full-length tests, and assigned practice.</p>
      <nav className="my-5 flex flex-wrap gap-2" aria-label="Saved practice">
        <Link className={`${button} px-4 py-2 ${mode === "boards" ? "bg-neutral-100 dark:bg-neutral-800" : ""}`} href="/whiteboards" aria-current={mode === "boards" ? "page" : undefined}>Saved Whiteboards</Link>
        <Link className={`${button} px-4 py-2 ${mode === "questions" ? "bg-neutral-100 dark:bg-neutral-800" : ""}`} href="/previous-questions" aria-current={mode === "questions" ? "page" : undefined}>Previous Questions</Link>
      </nav>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border px-3 py-2"><Search size={17} /><input aria-label={mode === "boards" ? "Search whiteboards" : "Search previous questions"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder={mode === "boards" ? "Search whiteboards…" : "Search question text, ID, session, or category…"} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>
        <select aria-label="Session type" className={`${button} px-3 py-2`} value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}><option value="all">All session types</option>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Sort saved practice" className={`${button} px-3 py-2`} value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Alphabetical</option></select>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border p-3 text-sm">{error}</p>}
      <p role="status" className="my-4 text-sm text-neutral-500">{loading ? "Loading saved practice…" : `${filtered.length} ${mode === "boards" ? filtered.length === 1 ? "whiteboard" : "whiteboards" : filtered.length === 1 ? "saved question" : "saved questions"}`}</p>
      <div className="grid gap-3">
        {visible.map((item) => "board" in item ? (
          <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div><h2 className="font-semibold">{item.board.title}</h2><p className="mt-1 text-sm text-neutral-500">{item.board.questions.length} questions · {kindLabels[item.kind]} · {dateLabel(item.date)}</p></div>
            <Link className={`${button} gap-2 px-3 py-2`} href={`/whiteboard?board=${encodeURIComponent(item.board.id)}`} target="_blank" rel="noopener noreferrer"><Presentation size={17} />Open whiteboard</Link>
          </article>
        ) : (
          <article key={item.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{domainNames[item.entry.question.domain] || item.entry.question.domain || "Question"}</h2><span className="text-xs text-neutral-500">{dateLabel(item.date)}</span></div>
            {item.entry.preview && <p className="mt-2 line-clamp-3 text-sm leading-6">{item.entry.preview}</p>}
            <p className="mt-2 text-xs text-neutral-500">{item.entry.source} · {item.entry.question.externalId || item.entry.question.id}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.entry.sessionId && <Link className={`${button} px-3 py-2`} href={`/review-session?local=${encodeURIComponent(item.entry.sessionId)}&question=${encodeURIComponent(item.entry.question.id)}`} target="_blank" rel="noopener noreferrer">Review answer</Link>}
              {item.entry.boardId ? <Link className={`${button} gap-2 px-3 py-2`} href={`/whiteboard?board=${encodeURIComponent(item.entry.boardId)}&question=${encodeURIComponent(item.entry.question.id)}`} target="_blank" rel="noopener noreferrer"><Presentation size={16} />Open in whiteboard</Link> : <button className={`${button} gap-2 px-3 py-2`} onClick={() => openQuestion(item.entry)}><Presentation size={16} />Open in whiteboard</button>}
            </div>
          </article>
        ))}
      </div>
      {!loading && !filtered.length && <p className="rounded-xl border p-6 text-sm text-neutral-500">{search || kind !== "all" ? "No saved items match these filters." : mode === "boards" ? "Open Whiteboard from any question or review to save your first board here." : "Questions will appear here after you start a practice session or save a whiteboard."}</p>}
      {pages > 1 && <nav aria-label="Saved practice pages" className="mt-5 flex items-center justify-between"><button className={`${button} p-2`} aria-label="Previous page" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={18} /></button><span className="text-sm">{currentPage + 1} / {pages}</span><button className={`${button} p-2`} aria-label="Next page" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ArrowRight size={18} /></button></nav>}
    </main>
  );
}
