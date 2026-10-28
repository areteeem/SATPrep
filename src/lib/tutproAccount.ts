"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_TUTPRO_SUPABASE_ANON_KEY;
export const tutproClient = url && key ? createClient(url, key, {
  auth: { storageKey: "sat_finder_tutpro_auth_v1", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;

export function signInWithTutPro(returnPath = "/assign") {
  const next = returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/assign";
  const target = new URL(next, window.location.origin);
  if (target.origin !== "https://artem-sat.vercel.app") throw new Error("TutPro sign-in is available on the production SAT Finder address.");
  window.location.assign(`https://www.tutpro.org/signin?returnTo=${encodeURIComponent(target.toString())}`);
}

export async function consumeTutProHandoff(code: string) {
  if (!url || !key || !tutproClient) throw new Error("TutPro sign-in is not configured.");
  if (!/^[a-f0-9]{64}$/i.test(code)) throw new Error("The sign-in link is invalid or expired.");
  const response = await fetch(`${url}/functions/v1/sso_consume`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ code }), signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.tokenHash !== "string") throw new Error("The sign-in link is invalid or expired. Please try again.");
  const result = await tutproClient.auth.verifyOtp({ token_hash: data.tokenHash, type: "magiclink" });
  if (result.error || !result.data.session) throw new Error("Could not complete TutPro sign-in. Please try again.");
  const next = String(data.returnPath || "/assign");
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(next)) return "/assign";
  return next;
}
