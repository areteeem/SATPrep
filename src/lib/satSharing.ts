"use client";
import { tutproClient } from "./tutproAccount";
const api = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_ANON_KEY;
export type PracticeSettings = {
  mode: "full" | "custom";
  domains: string[];
  count: number;
  minutes: number;
  assessment?: string;
  subject?: string;
  skills?: string[];
  difficulties?: ("E" | "M" | "H")[];
  randomize?: boolean;
  excludeBluebook?: boolean;
};
export function assignmentOptionsUrl(url: string, settings: PracticeSettings) {
  const target = new URL(url, location.origin);
  const options = {
    assessment: settings.assessment,
    subject: settings.subject,
    skills: settings.skills,
    difficulties: settings.difficulties,
    randomize: settings.randomize,
    excludeBluebook: settings.excludeBluebook,
  };
  target.hash = `${target.hash.slice(1).split("~")[0]}~${encodeURIComponent(JSON.stringify(options))}`;
  return target.toString();
}
export type ResultQuestion = {
  id: string;
  externalId: string;
  domain: string;
  answer: string;
};
export type SharedResult = {
  mode: "full" | "custom" | "rush";
  questions: ResultQuestion[];
};
export async function satRequest<T>(
  action: string,
  input: Record<string, unknown> = {},
  authenticated = false,
): Promise<T> {
  if (!api || !key) throw new Error("TutPro sharing is not configured.");
  const session = (await tutproClient?.auth.getSession())?.data.session || null;
  if (authenticated && !session)
    throw new Error("Sign in with your TutPro teacher account first.");
  const endpoint =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(location.hostname)
      ? "/api/sat-sharing"
      : `${api}/functions/v1/sat_practice`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...input }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      String(payload.error || "The sharing service is unavailable."),
    );
  return payload as T;
}

export function resultPath(url: string, assignmentToken?: string) {
  const parsed = new URL(url, location.origin);
  const token = parsed.hash.slice(1);
  if (assignmentToken)
    sessionStorage.setItem(`sat-result-assignment:${token}`, assignmentToken);
  sessionStorage.setItem("sat-current-result", token);
  return `/results#${token}`;
}
