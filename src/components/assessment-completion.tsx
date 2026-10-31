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
  redirect = true,
  onPublished,
  onResultReady,
}: {
  result: SharedResult;
  localId: string;
  assignmentToken?: string;
  redirect?: boolean;
  onPublished?: (url: string) => void | Promise<void>;
  onResultReady?: (url: string) => void;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState(""),
    [publishedUrl, setPublishedUrl] = useState("");
  const publishedToken = publishedUrl
    ? new URL(publishedUrl, "https://local.invalid").hash.slice(1)
    : "";
  useEffect(() => {
    if (started.current || !result.questions.length) return;
    started.current = true;
    const publicationKey = localId ? `sat-published-result-v1:${localId}` : "";
    if (publicationKey) {
      try {
        const existingUrl = localStorage.getItem(publicationKey);
        if (existingUrl) {
          if (redirect)
            router.replace(resultPath(existingUrl, assignmentToken));
          else {
            setPublishedUrl(existingUrl);
            onResultReady?.(existingUrl);
          }
          return;
        }
      } catch {}
    }
    void satRequest<{ url: string }>("create_result", {
      result,
      ...(assignmentToken ? { assignmentToken } : {}),
    })
      .then(async (data) => {
        if (publicationKey)
          try {
            localStorage.setItem(publicationKey, data.url);
          } catch {}
        await onPublished?.(data.url);
        if (redirect) router.replace(resultPath(data.url, assignmentToken));
        else {
          setPublishedUrl(data.url);
          onResultReady?.(data.url);
        }
      })
      .catch(() => {
        if (localId && redirect)
          router.replace(
            `/review-session?local=${encodeURIComponent(localId)}&completed=1`,
          );
        else
          setError(
            "Your result is saved on this device. The sharing service is unavailable.",
          );
      });
  }, [
    result,
    localId,
    assignmentToken,
    redirect,
    onPublished,
    onResultReady,
    router,
  ]);
  if (!redirect)
    return (
      <p role="status" className="my-3 text-sm text-neutral-500">
        {error ||
          (publishedUrl ? (
            <>
              Result link ready ·{" "}
              <a
                className="underline"
                href={`/results#${publishedToken}`}
                onClick={() => {
                  sessionStorage.setItem("sat-current-result", publishedToken);
                  if (assignmentToken)
                    sessionStorage.setItem(
                      `sat-result-assignment:${publishedToken}`,
                      assignmentToken,
                    );
                }}
              >
                Open shared result
              </a>
            </>
          ) : (
            "Saving your result…"
          ))}
      </p>
    );
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
