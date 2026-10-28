"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { MathJax } from "better-react-mathjax";
import Fraction from "fraction.js";
import { RotateCcw } from "lucide-react";
import { satRequest } from "@/lib/satSharing";
import { SendSatResult } from "@/components/send-sat-result";
import { AnnotatedPassage } from "@/components/annotated-passage";
import type { PlainQuestionType, API_Response_Question } from "@/types/question";

type Item = PlainQuestionType;
type Detail = API_Response_Question;
type Stage = "ready" | "rw1" | "rw2" | "break" | "math1" | "math2" | "done";
type Saved = { stage: Stage; banks: Item[][]; modules: Item[][]; index: number; answers: Record<string,string>; details: Record<string,Detail>; deadline: number; eliminated: Record<string,string[]>; notes: Record<string,string> };
const KEY = "sat-full-test-v1";
const rw = { INI: 7, CAS: 8, EOI: 5, SEC: 7 };
const rwFirst = { INI: 7, CAS: 7, EOI: 6, SEC: 7 };
const math = { H: 7, P: 8, Q: 3, S: 4 };
const mathFirst = { H: 8, P: 7, Q: 4, S: 3 };
const names: Record<string,string> = { INI:"Information and Ideas", CAS:"Craft and Structure", EOI:"Expression of Ideas", SEC:"Standard English Conventions", H:"Algebra", P:"Advanced Math", Q:"Problem-Solving and Data Analysis", S:"Geometry and Trigonometry" };
const empty: Saved = {stage:"ready", banks:[], modules:[], index:0, answers:{}, details:{}, deadline:0, eliminated:{}, notes:{}};
function shuffled<T>(items: T[]) { return [...items].sort(() => Math.random() - .5); }
function correct(answer: string | undefined, detail: Detail | undefined) {
  if (!answer || !detail?.correct_answer) return false;
  return detail.correct_answer.some(value => {
    if (value.trim().toLowerCase() === answer.trim().toLowerCase()) return true;
    try { return new Fraction(value.trim()).equals(new Fraction(answer.trim())); } catch { return false; }
  });
}
function pick(pool: Item[], counts: Record<string, number>, used: Set<string>, difficulty?: "hard" | "easy") {
  return Object.entries(counts).flatMap(([domain, count]) => {
    const eligible = shuffled(pool.filter(q => q.primary_class_cd === domain && !used.has(q.questionId) && (q.external_id || q.ibn)));
    if (difficulty) eligible.sort((a,b) => (difficulty === "hard" ? ["H","M","E"] : ["E","M","H"]).indexOf(a.difficulty) - (difficulty === "hard" ? ["H","M","E"] : ["E","M","H"]).indexOf(b.difficulty));
    if (eligible.length < count) throw new Error(`Not enough ${names[domain]} questions are available to build the test.`);
    const result = eligible.slice(0,count); result.forEach(q => used.add(q.questionId)); return result;
  });
}
const moduleIndex = (stage: Stage) => ({rw1:0,rw2:1,math1:2,math2:3} as Record<string,number>)[stage] ?? 0;
const duration = (stage: Stage) => stage.startsWith("rw") ? 32*60 : 35*60;
const button = "rounded-xl border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800";

function Countdown({ deadline, children }: { deadline: number; children: (seconds: number) => ReactNode }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return children(Math.max(0, Math.ceil((deadline - now) / 1000)));
}

export default function FullTest() {
  const [session, setSession] = useState<Saved>(empty);
  const [hydrated,setHydrated] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [review,setReview] = useState(false);
  const [reviewModule,setReviewModule] = useState(0);
  const [retry,setRetry] = useState(0);
  const [assignmentToken,setAssignmentToken] = useState("");
  const [storageKey,setStorageKey] = useState(KEY);
  const [shareUrl,setShareUrl] = useState("");
  useEffect(() => { try { const assigned = new URLSearchParams(location.search).get("assigned") === "1"; const token = assigned ? sessionStorage.getItem("sat-assignment-token") || "" : ""; if (assigned && !token) { setError("The assignment link is missing. Open the link again."); return; } const storage = token ? `${KEY}:${token}` : KEY; setAssignmentToken(token); setStorageKey(storage); const value = localStorage.getItem(storage); if (value) setSession(JSON.parse(value)); } catch {} setHydrated(true); }, []);
  useEffect(() => { if (hydrated) { try { localStorage.setItem(storageKey,JSON.stringify(session)); } catch { setError("Unable to save progress on this device. Check browser storage before continuing."); } } }, [session, hydrated, storageKey]);
  const stage = session.stage;
  const active = ["rw1","rw2","math1","math2"].includes(stage);
  const module = session.modules[stage === "done" ? reviewModule : moduleIndex(stage)] || [];
  const item = module[session.index];
  const detail = item && session.details[item.questionId];
  useEffect(() => {
    if (!item || detail) return;
    const controller = new AbortController();
    setError("");
    fetch(`/api/question/${encodeURIComponent(item.external_id || item.ibn || "")}`, {signal:controller.signal}).then(async response => {
      const data = await response.json(); if (!response.ok || !data.success || !data.data) throw new Error("Could not load this question. Check your connection and try again.");
      setSession(s => ({...s, details:{...s.details,[item.questionId]:data.data}}));
    }).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [item,detail,retry]);
  const advance = useCallback(() => setSession(s => {
    if (!["rw1","rw2","math1","math2"].includes(s.stage)) return s;
    const which = moduleIndex(s.stage);
    if (s.stage === "rw2") return {...s,stage:"break",index:0,deadline:Date.now()+600000};
    if (s.stage === "math2") return {...s,stage:"done",index:0,deadline:0};
    if (s.stage === "rw1" || s.stage === "math1") {
      const prior = s.modules[which];
      const n = prior.filter(q => correct(s.answers[q.questionId],s.details[q.questionId])).length;
      const next = s.stage === "rw1" ? "rw2" : "math2";
      const candidates = s.stage === "rw1" ? (n / prior.length >= .7 ? s.banks[0] : s.banks[1]) : (n / prior.length >= .7 ? s.banks[2] : s.banks[3]);
      const modules = [...s.modules]; modules[which+1] = candidates;
      return {...s,modules,stage:next,index:0,deadline:Date.now()+duration(next)*1000};
    }
    return s;
  }), []);
  useEffect(() => {
    if (!active || !session.deadline) return;
    const delay = session.deadline - Date.now();
    if (delay <= 0) { advance(); return; }
    const id = window.setTimeout(advance, delay + 20);
    return () => clearTimeout(id);
  }, [active, session.deadline, advance]);
  async function start() {
    setBusy(true); setError("");
    try {
      const responses = await Promise.all(["INI,CAS,EOI,SEC","H,P,Q,S"].map(domains => fetch(`/api/get-questions?assessment=SAT&domains=${domains}`).then(async r => { const data=await r.json(); if (!r.ok || !data.success) throw new Error(data.error || "Question bank unavailable."); return data.data as Item[]; })));
      const used = new Set<string>();
      const firstRW = pick(responses[0],rwFirst,used); const hardRW = pick(responses[0],rw,used,"hard"); const easyRW = pick(responses[0],rw,used,"easy");
      const firstMath = pick(responses[1],mathFirst,used); const hardMath = pick(responses[1],math,used,"hard"); const easyMath = pick(responses[1],math,used,"easy");
      setSession({...empty,stage:"rw1",banks:[hardRW,easyRW,hardMath,easyMath],modules:[firstRW,[],firstMath,[]],deadline:Date.now()+32*60000});
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare test."); } finally { setBusy(false); }
  }
  async function shareResult() {
    setBusy(true); setError("");
    try {
      const result = {mode:"full",questions:session.modules.flat().map(q=>({id:q.questionId,externalId:q.external_id || q.ibn || "",domain:q.primary_class_cd,answer:session.answers[q.questionId] || ""}))};
      const data = await satRequest<{url:string}>("create_result",{result,...(assignmentToken ? {assignmentToken} : {})});
      setShareUrl(data.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not share result."); }
    finally { setBusy(false); }
  }
  const formatClock = (remaining: number) => `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;
  const all = session.modules.flat();
  const points = all.filter(q => correct(session.answers[q.questionId],session.details[q.questionId])).length;
  const setAnswer = (value:string) => item && setSession(s => ({...s,answers:{...s.answers,[item.questionId]:value}}));
  return <main className="mx-auto max-w-6xl px-5 py-8 text-neutral-950 dark:text-neutral-50">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-700"><Link href="/" className="font-semibold">← SAT Finder</Link><div className="flex items-center gap-4">{(active || stage === "break") && <Countdown deadline={session.deadline}>{seconds=><span aria-label="Time remaining" className="font-mono text-lg">{formatClock(seconds)}</span>}</Countdown>}<button className={button} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }}>Full screen</button></div></header>
    {error && <p role="alert" className="my-5 rounded-xl border border-red-300 p-4">{error} <button className="underline" onClick={() => { setError(""); setRetry(n => n + 1); }}>Retry</button></p>}
    {stage === "ready" && <section className="mx-auto max-w-2xl py-16"><p className="text-sm uppercase tracking-widest text-neutral-500">Unofficial practice</p><h1 className="mt-3 text-4xl font-semibold">Full-Length Test</h1><p className="mt-5 leading-7 text-neutral-600 dark:text-neutral-400">98 questions in four timed modules: Reading and Writing (27 questions, 32 minutes each) and Math (22 questions, 35 minutes each), with a 10-minute break. Your work is saved on this device. The second module uses an approximate difficulty rule and results are not official SAT scores.</p><button onClick={start} disabled={busy || !hydrated} className={`${button} mt-8 bg-neutral-950 text-white hover:bg-neutral-800`}>{busy ? "Preparing questions…" : "Start test"}</button></section>}
    {stage === "break" && <section className="py-20 text-center"><h1 className="text-3xl font-semibold">Break</h1><p className="mt-4">Reading and Writing is complete. Math begins after the break.</p><Countdown deadline={session.deadline}>{seconds=><button className={`${button} mt-8`} disabled={seconds > 0} onClick={() => setSession(s => ({...s,stage:"math1",index:0,deadline:Date.now()+35*60000}))}>Begin Math {seconds > 0 ? `in ${formatClock(seconds)}` : ""}</button>}</Countdown></section>}
    {stage === "done" && !review && <section className="py-16"><h1 className="text-3xl font-semibold">Practice complete</h1><p className="mt-4 text-xl">{points} correct out of {all.length}</p><p className="mt-2 text-neutral-500">Unofficial practice result. This is not an SAT score.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{Object.entries(names).map(([key,name]) => { const qs=all.filter(q=>q.primary_class_cd===key); return <div key={key} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"><span>{name}</span><strong className="float-right">{qs.filter(q=>correct(session.answers[q.questionId],session.details[q.questionId])).length} / {qs.length}</strong></div>; })}</div><button className={`${button} mt-8`} disabled={busy} onClick={()=>void shareResult()}>{busy ? "Creating link…" : "Create result link"}</button> {shareUrl && <p className="mt-4 break-all">{shareUrl} <button className="underline" onClick={()=>void navigator.clipboard.writeText(shareUrl)}>Copy link</button></p>} {shareUrl && assignmentToken && <SendSatResult assignmentToken={assignmentToken} resultUrl={shareUrl}/>} <button className={`${button} mt-8`} onClick={()=>{setReview(true);setSession(s=>({...s,index:0}));}}>Review answers</button> <button className={button} onClick={()=>{if (window.confirm("Start over and remove this local result?")) {setReview(false);setSession(empty);}}}>Start over</button></section>}
    {(active || (stage === "done" && review)) && item && <section className="py-7"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="font-semibold">{stage === "done" ? "Review" : stage.startsWith("rw") ? "Reading and Writing" : "Math"} · Question {session.index+1} of {module.length}</h1><span className="text-sm text-neutral-500">{names[item.primary_class_cd]}</span></div>{!detail ? <p>Loading question…</p> : <div className="grid items-start gap-8 lg:grid-cols-2"><div className="sat-test-passage rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">{item.primary_class_cd in rw ? <AnnotatedPassage questionId={item.questionId} html={detail.stimulus || ""}/> : <MathJax dynamic><div dangerouslySetInnerHTML={{__html:detail.stimulus || ""}} /></MathJax>}{stage.startsWith("rw") && <label className="mt-6 block text-sm font-medium">Notes<textarea value={session.notes[item.questionId] || ""} onChange={e=>setSession(s=>({...s,notes:{...s.notes,[item.questionId]:e.target.value}}))} className="mt-2 block min-h-24 w-full rounded-lg border border-neutral-300 bg-transparent p-3" /></label>}</div><div><MathJax dynamic><div className="mb-6" dangerouslySetInnerHTML={{__html:detail.stem}} /></MathJax>{detail.answerOptions ? Object.entries(detail.answerOptions).map(([key,value]) => <div key={key} className="mb-3 flex gap-2"><button disabled={stage === "done" || session.eliminated[item.questionId]?.includes(key)} onClick={()=>setAnswer(key)} className={`${button} flex-1 text-left ${session.answers[item.questionId]===key ? "border-neutral-950 bg-neutral-100 dark:bg-neutral-800" : ""} ${session.eliminated[item.questionId]?.includes(key) ? "line-through opacity-50" : ""}`}><span className="mr-3 font-semibold">{key}</span><MathJax inline dynamic><span dangerouslySetInnerHTML={{__html:value}} /></MathJax></button>{stage !== "done" && <button aria-label={`${session.eliminated[item.questionId]?.includes(key) ? "Restore" : "Eliminate"} option ${key}`} aria-pressed={Boolean(session.eliminated[item.questionId]?.includes(key))} className={`${button} flex h-11 w-11 shrink-0 items-center justify-center p-2`} onClick={()=>setSession(s=>{const old=s.eliminated[item.questionId] || []; const exists=old.includes(key); return {...s,answers: !exists && s.answers[item.questionId]===key ? {...s.answers,[item.questionId]:""} : s.answers, eliminated:{...s.eliminated,[item.questionId]:exists ? old.filter(x=>x!==key) : [...old,key]}};})}>{session.eliminated[item.questionId]?.includes(key) ? <RotateCcw size={17} aria-hidden="true"/> : <span aria-hidden="true" className="text-lg leading-none">╱</span>}</button>}</div>) : <input aria-label="Your answer" disabled={stage === "done"} value={session.answers[item.questionId] || ""} onChange={e=>setAnswer(e.target.value)} className="w-full rounded-xl border border-neutral-300 bg-transparent p-3" placeholder="Enter your answer"/>}{stage === "done" && <div className="mt-6 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-800"><p>Your answer: {session.answers[item.questionId] || "No answer"}</p><p className="mt-2">Correct answer: {detail.correct_answer?.join(", ") || "Unavailable"}</p><p className="mt-4 font-semibold">Explanation</p>{detail.rationale ? <MathJax dynamic><div dangerouslySetInnerHTML={{__html:detail.rationale}} /></MathJax> : <p>No explanation is available for this question.</p>}</div>}</div></div>}
      <div className="mt-8 flex flex-wrap gap-2"><button className={button} disabled={session.index===0} onClick={()=>setSession(s=>({...s,index:s.index-1}))}>Previous</button><button className={button} disabled={session.index>=module.length-1} onClick={()=>setSession(s=>({...s,index:s.index+1}))}>Next</button>{active && <button className={`${button} ml-auto`} onClick={()=>{if(window.confirm("Finish this module? You cannot return to it.")) advance();}}>Finish module</button>}{stage === "done" && <><select aria-label="Review module" className={button} value={reviewModule} onChange={e=>{setReviewModule(Number(e.target.value));setSession(s=>({...s,index:0}));}}><option value="0">Reading and Writing 1</option><option value="1">Reading and Writing 2</option><option value="2">Math 1</option><option value="3">Math 2</option></select><button className={button} onClick={()=>setReview(false)}>Back to results</button></>}</div>
    </section>}
  </main>;
}
