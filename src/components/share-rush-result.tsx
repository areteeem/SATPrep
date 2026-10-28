"use client";
import { useState } from 'react';
import type { PracticeSession } from '@/types/session';
import { satRequest } from '@/lib/satSharing';
export function ShareRushResult({session}:{session:PracticeSession}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function create(){setBusy(true);setError('');try{const questions=session.answeredQuestionDetails.map(q=>({id:q.questionId,externalId:q.externalId||q.ibn||'',domain:q.plainQuestion?.primary_class_cd||'',answer:session.questionAnswers[q.questionId]||''}));if(!questions.length||questions.length>500||questions.some(q=>!q.externalId||!q.domain))throw new Error('This session is missing question information needed to share it.');const data=await satRequest<{url:string}>('create_result',{result:{mode:'rush',questions}});setUrl(data.url);}catch(e){setError(e instanceof Error?e.message:'Could not share this result.');}finally{setBusy(false);}}
 return <div className="mx-auto max-w-xl px-5 py-4 text-center"><button className="rounded-xl border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={()=>void create()}>{busy?'Creating link…':'Create result link'}</button>{url&&<p className="mt-3 break-all">{url} <button className="underline" onClick={()=>void navigator.clipboard.writeText(url)}>Copy link</button></p>}{error&&<p className="mt-2 text-red-700" role="alert">{error}</p>}</div>;
}
