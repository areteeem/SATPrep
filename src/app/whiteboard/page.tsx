"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { readWhiteboard, storeWhiteboard } from "@/lib/assessment-workspace";
import type { WhiteboardDocument } from "@/lib/assessment-workspace";
const Canvas = dynamic(() => import("@/components/assessment-whiteboard"), {
  ssr: false,
  loading: () => <p className="p-8">Opening whiteboard…</p>,
});
export default function Whiteboard() {
  const [board, setBoard] = useState<WhiteboardDocument | null>(null),
    [error, setError] = useState(""),
    [initialQuestionId, setInitialQuestionId] = useState("");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const params = new URLSearchParams(location.search);
        const id = params.get("board");
        setInitialQuestionId(params.get("question") || "");
        if (!id && params.get("blank") === "1") {
          const createdAt = new Date().toISOString();
          const blankBoard: WhiteboardDocument = {
            id: crypto.randomUUID(),
            title: "Whiteboard",
            questions: [],
            createdAt,
          };
          await storeWhiteboard(blankBoard);
          if (alive) setBoard(blankBoard);
          return;
        }
        if (!id)
          throw new Error(
            "Open a question or marked set with the Whiteboard button.",
          );
        const saved = await readWhiteboard(id);
        if (!saved)
          throw new Error("This whiteboard is not stored on this device.");
        const questions: typeof saved.questions = [];
        for (let i = 0; i < saved.questions.length; i += 6) {
          questions.push(
            ...(await Promise.all(
              saved.questions.slice(i, i + 6).map(async (q) => {
                if (q.detail) return q;
                try {
                  const response = await fetch(
                    `/api/question/${encodeURIComponent(q.externalId)}`,
                  );
                  const payload = await response.json();
                  return {
                    ...q,
                    detail: response.ok ? payload.data : undefined,
                  };
                } catch {
                  return q;
                }
              }),
            )),
          );
        }
        const ready = { ...saved, questions };
        await storeWhiteboard(ready);
        if (alive) setBoard(ready);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not open this whiteboard.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return error ? (
    <main className="p-8">
      <h1 className="text-2xl">Whiteboard unavailable</h1>
      <p className="mt-4" role="alert">
        {error}
      </p>
    </main>
  ) : board ? (
    <Canvas board={board} initialQuestionId={initialQuestionId} />
  ) : (
    <p className="p-8">Preparing questions for your whiteboard…</p>
  );
}
