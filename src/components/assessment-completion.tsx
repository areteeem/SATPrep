"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { satRequest, resultPath } from "@/lib/satSharing";
import type { SharedResult } from "@/lib/satSharing";
import { assessmentButton as button } from "@/components/assessment-controls";
export function AssessmentCompletion({
  result,
  localId,
  assignmentToken,
}: {
  result: SharedResult;
  localId: string;
  assignmentToken?: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current || !result.questions.length) return;
    started.current = true;
    const publicationKey = localId
      ? `sat-published-result-v1:${localId}`
      : "";
    if (publicationKey) {
      try {
        const existingUrl = localStorage.getItem(publicationKey);
        if (existingUrl) {
          router.replace(resultPath(existingUrl, assignmentToken));
          return;
        }
      } catch {}
    }
    void satRequest<{ url: string }>("create_result", {
      result,
      ...(assignmentToken ? { assignmentToken } : {}),
    })
      .then((data) => {
        if (publicationKey)
          try {
            localStorage.setItem(publicationKey, data.url);
          } catch {}
        router.replace(resultPath(data.url, assignmentToken));
      })
      .catch(() => {
        if (localId)
          router.replace(
            `/review-session?local=${encodeURIComponent(localId)}&completed=1`,
          );
        else
          setError(
            "Your result is saved on this device. The sharing service is unavailable.",
          );
      });
  }, [result, localId, assignmentToken, router]);
  return (
    <p role="status" className="my-5 text-sm">
      {error || "Saving your result and opening the result page…"}
    </p>
  );
}
export function SendLocalResult({
  result,
  assignmentToken,
}: {
  result: SharedResult;
  assignmentToken?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <button
        className={button}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void satRequest<{ url: string }>("create_result", {
            result,
            ...(assignmentToken ? { assignmentToken } : {}),
          })
            .then((data) => router.push(resultPath(data.url, assignmentToken)))
            .catch((e) =>
              setError(
                e instanceof Error ? e.message : "Sharing is unavailable.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Opening result…" : "Send result to teacher’s Telegram"}
      </button>
      {error && (
        <p className="mt-2 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
