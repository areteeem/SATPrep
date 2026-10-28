"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { consumeTutProHandoff } from "@/lib/tutproAccount";

export default function Callback() {
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(location.hash.slice(1)).get("sso") || "";
    history.replaceState(null, "", location.pathname);
    void consumeTutProHandoff(code).then(path => location.replace(path)).catch(e => setError(e instanceof Error ? e.message : "Could not sign in."));
  }, []);
  return <main className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-semibold">TutPro sign-in</h1><p className="mt-4" role={error ? "alert" : "status"}>{error || "Completing your sign-in…"}</p>{error && <Link className="mt-4 inline-block underline" href="/assign">Return to assignments</Link>}</main>;
}
