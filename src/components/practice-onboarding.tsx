"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  Gauge,
  GraduationCap,
  Lightbulb,
  PenLine,
  Shapes,
  Sigma,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { domains } from "@/static-data/domains";
import type { PracticeSelections } from "@/types/session";
import type { QuestionDifficulty } from "@/types/question";

const domainIcons: Record<string, LucideIcon> = {
  H: BarChart3,
  P: Sigma,
  Q: TrendingUp,
  S: Shapes,
  INI: Lightbulb,
  CAS: BookOpen,
  EOI: PenLine,
  SEC: FileText,
};
const difficulties: {
  value: QuestionDifficulty;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: "E", label: "Easy", Icon: Gauge },
  { value: "M", label: "Medium", Icon: BarChart3 },
  { value: "H", label: "Hard", Icon: TrendingUp },
];
export const setupButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";

export default function PracticeOnboarding({
  onComplete,
  submitLabel = "Start Practice",
  embedded = false,
}: {
  onComplete: (selections: PracticeSelections) => void;
  submitLabel?: string;
  embedded?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [assessment, setAssessment] = useState("SAT");
  const [subject, setSubject] = useState("math");
  const [skills, setSkills] = useState<string[]>([]);
  const [levels, setLevels] = useState<QuestionDifficulty[]>([]);
  const [randomize, setRandomize] = useState(true);
  const [excludeBluebook, setExcludeBluebook] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const subjectDomains = subject === "math" ? domains.Math : domains["R&W"];
  useEffect(() => {
    if (!embedded) window.scrollTo({ top: 0 });
  }, [step, embedded]);
  const finish = () =>
    onComplete({
      practiceType: "rush",
      assessment,
      subject,
      domains: subjectDomains
        .filter((d) => d.skill.some((s) => skills.includes(s.skill_cd)))
        .map(({ id, text, primaryClassCd }) => ({ id, text, primaryClassCd })),
      skills: subjectDomains
        .flatMap((d) => d.skill)
        .filter((s) => skills.includes(s.skill_cd)),
      difficulties: levels,
      randomize,
      excludeBluebook,
    });
  const toggleSkill = (code: string) =>
    setSkills((old) =>
      old.includes(code) ? old.filter((v) => v !== code) : [...old, code],
    );
  return (
    <section
      className={`${embedded ? "" : "mx-auto min-h-dvh max-w-7xl px-5 pb-4 pt-3"} space-y-3`}
      data-step={step + 1}
      data-no-image-viewer
    >
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Practice Rush · Step {step + 1} of 3
        </p>
        <h1 className="text-3xl font-semibold">
          {step === 0
            ? "Choose Assessment"
            : step === 1
              ? "Choose Subject"
              : "Choose Domains, Skills & Difficulty"}
        </h1>
      </div>
      {step === 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              value: "SAT",
              label: "SAT",
              description: "Digital SAT Assessment",
              Icon: FileText,
            },
            {
              value: "PSAT/NMSQT",
              label: "PSAT/NMSQT",
              description: "PSAT/NMSQT & PSAT 10",
              Icon: GraduationCap,
            },
            {
              value: "PSAT",
              label: "PSAT 8/9",
              description: "PSAT 8/9 Assessment",
              Icon: BookOpen,
            },
          ].map(({ value, label, description, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={assessment === value}
              data-selected={assessment === value}
              onClick={() => setAssessment(value)}
              className="setup-choice"
            >
              <Icon size={40} strokeWidth={1.5} />
              <strong className="text-xl">{label}</strong>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {description}
              </span>
              {assessment === value && (
                <CheckCircle2 className="setup-check" size={20} />
              )}
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "math",
              label: "Math",
              description: "Practice SAT Math problems",
              Icon: Sigma,
            },
            {
              value: "reading-writing",
              label: "Reading & Writing",
              description: "Practice SAT Reading and Writing problems",
              Icon: BookOpen,
            },
          ].map(({ value, label, description, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={subject === value}
              data-selected={subject === value}
              onClick={() => {
                if (value !== subject) {
                  setSubject(value);
                  setSkills([]);
                  setExpanded([]);
                }
              }}
              className="setup-choice"
            >
              <Icon size={40} strokeWidth={1.5} />
              <strong className="text-xl">{label}</strong>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {description}
              </span>
              {subject === value && (
                <CheckCircle2 className="setup-check" size={20} />
              )}
            </button>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">
            Select domains and then choose specific skills within each domain.
            You must select at least one skill to continue.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={setupButton}
              onClick={() => {
                setSkills(
                  subjectDomains.flatMap((d) => d.skill.map((s) => s.skill_cd)),
                );
                setExpanded(subjectDomains.map((d) => d.id));
              }}
            >
              Select All Skills
            </button>
            <button className={setupButton} onClick={() => setSkills([])}>
              Clear All Skills
            </button>
            <span className="self-center text-sm text-neutral-500">
              {skills.length} skills selected
            </span>
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {subjectDomains.map((domain) => {
              const Icon = domainIcons[domain.primaryClassCd] || BookOpen;
              const selected = domain.skill.some((s) =>
                skills.includes(s.skill_cd),
              );
              const open = expanded.includes(domain.id);
              return (
                <section
                  key={domain.id}
                  className="setup-domain"
                  data-selected={selected}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`${domain.text} skills`}
                    className="flex w-full items-start gap-3 p-3 text-left"
                    onClick={() => {
                      setExpanded((old) =>
                        open
                          ? old.filter((v) => v !== domain.id)
                          : [...old, domain.id],
                      );
                      if (!selected && !open)
                        setSkills((old) => [
                          ...new Set([
                            ...old,
                            ...domain.skill.map((s) => s.skill_cd),
                          ]),
                        ]);
                    }}
                  >
                    <Icon size={24} />
                    <span className="flex-1">
                      <strong className="block font-semibold">
                        {domain.text}
                      </strong>
                      <span className="mt-1 block text-xs text-neutral-500">
                        {
                          domain.skill.filter((s) =>
                            skills.includes(s.skill_cd),
                          ).length
                        }{" "}
                        of {domain.skill.length} skills selected
                      </span>
                    </span>
                    {selected && <Check size={18} />}
                  </button>
                  {open ? (
                    <div className="space-y-1 border-t border-neutral-200 p-3 dark:border-neutral-700">
                      {domain.skill.map((skill) => (
                        <label
                          key={skill.skill_cd}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-neutral-950"
                            checked={skills.includes(skill.skill_cd)}
                            onChange={() => toggleSkill(skill.skill_cd)}
                          />
                          {skill.text}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-0.5 px-3 pb-3 text-xs text-neutral-500">
                      {domain.skill.slice(0, 3).map((skill) => (
                        <li key={skill.skill_cd}>{skill.text}</li>
                      ))}
                      {domain.skill.length > 3 && (
                        <li>+{domain.skill.length - 3} more skills</li>
                      )}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg font-semibold">
              Select Difficulty Levels
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {difficulties.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className="setup-difficulty"
                  data-selected={levels.includes(value)}
                  aria-pressed={levels.includes(value)}
                  onClick={() =>
                    setLevels((old) =>
                      old.includes(value)
                        ? old.filter((v) => v !== value)
                        : [...old, value],
                    )
                  }
                >
                  <Icon size={21} />
                  <span>{label}</span>
                  {levels.includes(value) && (
                    <Check size={17} className="ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <legend className="px-1 font-medium">Practice settings</legend>
            <label className="flex items-center justify-between gap-4 text-sm">
              Randomize question order
              <input
                type="checkbox"
                checked={randomize}
                onChange={(e) => setRandomize(e.target.checked)}
                className="size-4 accent-neutral-950"
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              Exclude Bluebook questions
              <input
                type="checkbox"
                checked={excludeBluebook}
                onChange={(e) => setExcludeBluebook(e.target.checked)}
                className="size-4 accent-neutral-950"
              />
            </label>
          </fieldset>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {step > 0 && (
          <button className={setupButton} onClick={() => setStep(step - 1)}>
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        <button
          className={`${setupButton} bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950`}
          disabled={step === 2 && (!skills.length || !levels.length)}
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
        >
          {step === 0
            ? "Choose Subject"
            : step === 1
              ? "Choose Domains, Skills & Difficulty"
              : submitLabel}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
