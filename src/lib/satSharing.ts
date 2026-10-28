"use client";
import { tutproClient } from './tutproAccount';
const api = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_ANON_KEY;
export type PracticeSettings = { mode:'full'|'custom'; domains:string[]; count:number; minutes:number };
export type ResultQuestion = { id:string; externalId:string; domain:string; answer:string };
export type SharedResult = { mode:'full'|'custom'|'rush'; questions:ResultQuestion[] };
export async function satRequest<T>(action:string, input:Record<string,unknown> = {}, authenticated = false):Promise<T> {
  if (!api || !key) throw new Error('TutPro sharing is not configured.');
  const session = (await tutproClient?.auth.getSession())?.data.session || null;
  if (authenticated && !session) throw new Error('Sign in with your TutPro teacher account first.');
  const response=await fetch(`${api}/functions/v1/sat_practice`, {method:'POST',headers:{'Content-Type':'application/json',apikey:key, ...(session ? {Authorization:`Bearer ${session.access_token}`} : {})},body:JSON.stringify({action,...input}),signal:AbortSignal.timeout(20000)});
  const payload=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(String(payload.error || 'The sharing service is unavailable.'));
  return payload as T;
}
