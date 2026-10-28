import Link from "next/link";
import { ArrowUpRight, BookOpen, ClipboardList, FileCheck2, LayoutDashboard, Search, Timer, Presentation, History } from "lucide-react";

const choices = [
  { href: "/practice", title: "Practice Rush", icon: Timer },
  { href: "/full-test", title: "Full-Length Test", icon: BookOpen },
  { href: "/questionbank", title: "Question Bank", icon: BookOpen },
  { href: "/question", title: "Search Questions", icon: Search },
  { href: "/results", title: "Check Results", icon: FileCheck2 },
  { href: "/previous-questions", title: "Previous Questions", icon: History },
  { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard },
  { href: "/whiteboards", title: "Saved Whiteboards", icon: Presentation },
  { href: "/whiteboard?blank=1", title: "Open Whiteboard", icon: Presentation, newTab: true },
  { href: "/assign", title: "Assign", icon: ClipboardList },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col justify-center px-4 py-3">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-neutral-500">
          SAT Finder
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Choose how to practice.
        </h1>
      </header>
      <div className="mx-auto mt-4 flex w-full max-w-md flex-col gap-1.5">
        {choices.map(({ href, title, icon: Icon, newTab }) => (
          <Link
            key={href}
            href={href}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noopener noreferrer" : undefined}
            className="group flex h-9 w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 text-left text-neutral-950 transition-colors hover:border-neutral-500 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
          >
            <Icon size={17} strokeWidth={1.8} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
            <ArrowUpRight size={16} className="shrink-0 opacity-60" />
          </Link>
        ))}
      </div>
    </main>
  );
}
