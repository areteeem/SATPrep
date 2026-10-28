import Link from "next/link";
import { ArrowUpRight, BookOpen, ClipboardList, FileCheck2, Timer } from "lucide-react";

const choices = [
  { href: "/practice", title: "Practice Rush", description: "Practice questions at your own pace.", icon: Timer },
  { href: "/full-test", title: "Full-Length Test", description: "Practice with SAT-style timed modules.", icon: BookOpen },
  { href: "/assign", title: "Assign", description: "Create practice for a student.", icon: ClipboardList },
  { href: "/results", title: "Check Results", description: "Review a completed practice session.", icon: FileCheck2 },
];

export default function Home() {
  return <main className="mx-auto min-h-[80vh] max-w-5xl px-6 py-20 sm:py-28">
    <p className="text-sm font-semibold uppercase tracking-[.2em] text-neutral-500">SAT Finder</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Choose how to practice.</h1>
    <div className="mt-12 grid gap-3 sm:grid-cols-2">
      {choices.map(({href, title, description, icon: Icon}) => <Link key={href} href={href} className="group flex min-h-40 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-950 transition-colors hover:border-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-4 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
        <div className="flex justify-between"><Icon size={23} strokeWidth={1.7}/><ArrowUpRight size={20}/></div>
        <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-neutral-500">{description}</p></div>
      </Link>)}
    </div>
  </main>;
}
