"use client";

import type { User } from "@/lib/types/auth";
import type { UserData } from "@/lib/types/userData";

const AUTH_KEY = "study-platform:auth";
const DATA_KEY = "study-platform:data";

const emptyData: UserData = {
  profile: null,
  statistics: {},
  sessions: [],
  bookmarks: [],
  collections: [],
  vocabulary: null,
  preferences: { data_mode_priority: "localstorage" },
  answerHistory: null,
  questionNotes: null,
  vocabPracticePerformance: null,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

export function getLocalUser(): User | null {
  return read<User | null>(AUTH_KEY, null);
}

export function saveLocalUser(user: User | null) {
  if (user) write(AUTH_KEY, user);
  else if (typeof window !== "undefined") window.localStorage.removeItem(AUTH_KEY);
}

export function getLocalData(): UserData {
  return { ...emptyData, ...read<Partial<UserData>>(DATA_KEY, {}) };
}

export function saveLocalData(data: UserData) {
  write(DATA_KEY, data);
}

export async function localApiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = String(input);
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const method = (init.method ?? "GET").toUpperCase();
  const data = getLocalData();
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  const field = path.match(/\/api\/user\/(profile|statistics|sessions|bookmarks|collections|vocabulary|preferences|notes|answer-history|vocab-practice-performance)/)?.[1];

  if (method === "GET" && path.endsWith("/api/user/data")) return Response.json({ data });
  if (field && method !== "GET") {
    const key = field === "notes" ? "questionNotes" : field === "answer-history" ? "answerHistory" : field === "vocab-practice-performance" ? "vocabPracticePerformance" : field;
    if (field === "sessions" && path.includes("/") && method === "DELETE") {
      const id = path.split("/").pop();
      data.sessions = data.sessions.filter((session) => session.sessionId !== id);
    } else if (method === "DELETE") {
      (data[key as keyof UserData] as unknown) = Array.isArray(data[key as keyof UserData]) ? [] : null;
    } else if (field === "statistics" && body?.assessment) {
      data.statistics = { ...data.statistics, [body.assessment]: body.statistics ?? body };
    } else if (field === "sessions" && body) {
      const index = data.sessions.findIndex((session) => session.sessionId === body.sessionId);
      if (index >= 0) data.sessions[index] = body;
      else data.sessions.push(body);
    } else if (field === "bookmarks" && body?.questionId) {
      data.bookmarks = data.bookmarks.filter((item) => item.questionId !== body.questionId);
      if (method !== "DELETE") data.bookmarks.push(body);
    } else {
      (data[key as keyof UserData] as unknown) = body?.data ?? body;
    }
    saveLocalData(data);
    const responseData =
      field === "statistics"
        ? { statistics: data.statistics }
        : field === "sessions"
          ? { session: body ?? data.sessions.find((session) => session.sessionId === path.split("/").pop()) }
          : data[key as keyof UserData];
    return Response.json({ data: responseData });
  }
  return Response.json({ data: null });
}
