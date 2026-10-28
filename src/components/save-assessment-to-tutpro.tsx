"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { assessmentButton as button } from "@/components/assessment-controls";
import type { SharedResult } from "@/lib/satSharing";
import { resultPath, satRequest } from "@/lib/satSharing";
import { signInWithTutPro, tutproClient } from "@/lib/tutproAccount";

export function SaveAssessmentToTutPro({ result }: { result: SharedResult }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const session = (await tutproClient?.auth.getSession())?.data.session;
      const { url } = await satRequest<{ url: string }>(
        "create_result",
        { result },
        Boolean(session),
      );
      const token = new URL(url).hash.slice(1);
      if (!/^[a-f0-9]{64}$/.test(token))
        throw new Error("TutPro returned an invalid result link.");

      if (session) {
        router.push(resultPath(url));
      } else {
        signInWithTutPro(`/results?claim=1#${token}`);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save this session to TutPro.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        className={button}
        disabled={busy || !result.questions.length}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save to TutPro account"}
      </button>
      {message && (
        <p className="text-sm text-neutral-600" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
