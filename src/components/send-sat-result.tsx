"use client";
import { useState } from 'react';
import { satRequest } from '@/lib/satSharing';
export function SendSatResult({assignmentToken,resultUrl}:{assignmentToken:string;resultUrl:string}) {
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function send(){setBusy(true);setMessage('');try{const token=new URL(resultUrl).hash.slice(1);const x=await satRequest<{status:string;reason?:string}>('notify_teacher',{assignmentToken,resultToken:token});setMessage(x.status==='sent'?'Delivered to the teacher’s Telegram.':x.status==='pending'||x.status==='leased'?'Queued for Telegram delivery.':`Telegram delivery status: ${x.status}${x.reason?` (${x.reason})`:''}.`);}catch(e){setMessage(e instanceof Error?e.message:'Could not queue Telegram delivery.');}finally{setBusy(false);}}
 return <div className="mt-4"><button className="rounded-xl border px-4 py-2 disabled:opacity-50" onClick={()=>void send()} disabled={busy}>{busy?'Checking…':'Send result to teacher’s Telegram'}</button><p className="mt-2 text-sm" role="status">{message}</p></div>;
}
