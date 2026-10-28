"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, ListChecks } from "lucide-react";
import { signInWithTutPro, tutproClient } from "@/lib/tutproAccount";
import {
  assignmentOptionsUrl,
  satRequest,
  type PracticeSettings,
} from "@/lib/satSharing";
import PracticeOnboarding, {
  setupButton,
} from "@/components/practice-onboarding";
import type { PracticeSelections } from "@/types/session";

const allDomains = ["INI", "CAS", "EOI", "SEC", "H", "P", "Q", "S"];
export default function Assign() {
  const [signed, setSigned] = useState(false),
    [mode, setMode] = useState<"full" | "custom">("full"),
    [selection, setSelection] = useState<PracticeSelections | null>(null),
    [count, setCount] = useState(20),
    [minutes, setMinutes] = useState(30),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void tutproClient?.auth
      .getUser()
      .then(({ data }) => setSigned(Boolean(data.user)));
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const settings: PracticeSettings =
        mode === "full"
          ? { mode, domains: allDomains, count: 98, minutes: 134 }
          : {
              mode,
              domains: selection?.domains.map((d) => d.primaryClassCd) || [],
              count,
              minutes,
              assessment: selection?.assessment,
              subject: selection?.subject,
              skills: selection?.skills.map((s) => s.skill_cd),
              difficulties: selection?.difficulties,
              randomize: selection?.randomize,
              excludeBluebook: selection?.excludeBluebook,
            };
      const value = await satRequest<{ url: string }>(
        "create_assignment",
        { settings },
        true,
      );
      setUrl(
        mode === "custom"
          ? assignmentOptionsUrl(value.url, settings)
          : value.url,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create assignment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-5 py-12">
      <Link href="/">← Home</Link>
      <h1 className="mt-8 text-3xl font-semibold">Assign practice</h1>
      <p className="mt-3 text-neutral-500">
        Choose the same assessment, subject, skills, and settings as a Practice
        Rush, then create a private student link.
      </p>
      <div className="my-7 grid gap-3 sm:grid-cols-2">
        {[
          {
            value: "full" as const,
            title: "Full-length test",
            Icon: FileText,
            description: "98 questions · four timed modules",
          },
          {
            value: "custom" as const,
            title: "Practice Rush",
            Icon: ListChecks,
            description: "Choose domains, skills, difficulty and time",
          },
        ].map(({ value, title, Icon, description }) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            data-selected={mode === value}
            className="setup-choice"
            onClick={() => {
              setMode(value);
              setUrl("");
            }}
          >
            <Icon size={32} />
            <strong>{title}</strong>
            <span className="text-sm text-neutral-500">{description}</span>
            {mode === value && (
              <CheckCircle2 className="setup-check" size={20} />
            )}
          </button>
        ))}
      </div>
      {mode === "custom" &&
        (!selection ? (
          <PracticeOnboarding
            embedded
            onComplete={setSelection}
            submitLabel="Use these settings"
          />
        ) : (
          <section className="space-y-4 rounded-xl border p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold">
                {selection.assessment} ·{" "}
                {selection.subject === "math" ? "Math" : "Reading & Writing"}
              </h2>
              <button
                className={setupButton}
                onClick={() => setSelection(null)}
              >
                Change selections
              </button>
            </div>
            <p className="text-sm text-neutral-500">
              {selection.domains.map((d) => d.text).join(", ")} ·{" "}
              {selection.skills.length} skills ·{" "}
              {selection.difficulties
                .map((d) => ({ E: "Easy", M: "Medium", H: "Hard" })[d])
                .join(", ")}
            </p>
            <p className="text-sm text-neutral-500">
              {selection.randomize ? "Randomized order" : "Original order"} ·{" "}
              {selection.excludeBluebook
                ? "Bluebook questions excluded"
                : "Bluebook questions included"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Number of questions
                <input
                  className="mt-2 block w-full rounded-xl border bg-transparent p-3"
                  type="number"
                  min={1}
                  max={98}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                Time limit in minutes
                <input
                  className="mt-2 block w-full rounded-xl border bg-transparent p-3"
                  type="number"
                  min={1}
                  max={240}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
            </div>
          </section>
        ))}
      <div className="mt-7">
        {signed ? (
          <button
            onClick={() => void create()}
            disabled={
              busy ||
              (mode === "custom" && !selection) ||
              count < 1 ||
              count > 98 ||
              minutes < 1 ||
              minutes > 240
            }
            className={`${setupButton} bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950`}
          >
            {busy ? "Creating…" : "Create assignment"}
          </button>
        ) : (
          <button
            className={`${setupButton} bg-neutral-950 text-white dark:bg-neutral-100 dark:text-neutral-950`}
            onClick={() => {
              try {
                signInWithTutPro("/assign");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Sign-in unavailable",
                );
              }
            }}
          >
            Sign in with TutPro to create the link
          </button>
        )}
      </div>
      {url && (
        <div className="mt-6 rounded-xl border p-4">
          <p className="break-all text-sm">{url}</p>
          <button
            className={`${setupButton} mt-3`}
            onClick={() => void navigator.clipboard.writeText(url)}
          >
            Copy link
          </button>
        </div>
      )}
      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
