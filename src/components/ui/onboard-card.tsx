"use client";
import { useEffect, useState } from "react";
import { Check, FileCheck2, ListFilter, LoaderCircle, Play, Search } from "lucide-react";
type Step={id:string;title:string;content:React.ReactNode};
export default function OnboardCard({steps,currentStep,duration=3000,autoPlay=true,onStepChange}:{steps:Step[];currentStep?:number;duration?:number;autoPlay?:boolean;onStepChange?:(step:number)=>void}) {
  const [internal,setInternal]=useState(1);
  const active=Math.max(1,Math.min(steps.length,currentStep??internal));
  useEffect(()=>{if(currentStep!==undefined||!autoPlay)return;const timer=setInterval(()=>setInternal((old)=>old>=steps.length?1:old+1),duration/steps.length);return()=>clearInterval(timer);},[currentStep,autoPlay,duration,steps.length]);
  useEffect(()=>{onStepChange?.(active);},[active,onStepChange]);
  const icons=[ListFilter,Search,LoaderCircle,FileCheck2,Play];
  return <div className="relative h-64 w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-background px-4 dark:border-neutral-700" aria-label="Preparing practice" aria-live="polite">
    <div className="practice-progress-track space-y-3" style={{transform:`translateY(${90-(active-1)*76}px)`}}>{steps.map((step,index)=>{const Icon=icons[index]||LoaderCircle;return <div key={step.id} className={`flex min-h-16 items-center gap-3 rounded-xl border p-4 ${active===index+1?"border-neutral-950 bg-neutral-100 dark:border-neutral-50 dark:bg-neutral-800":"border-neutral-200 text-neutral-500 dark:border-neutral-700"}`} style={{opacity:active===index+1?1:.5}}>{active>index+1?<Check size={19}/>:<Icon size={19}/>}<span className="text-sm font-medium">{step.content}</span></div>;})}</div>
  </div>;
}
