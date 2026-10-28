import Link from "next/link";
import { LayoutDashboard, LibraryBig, Search } from "lucide-react";

export function PracticeLocalNav() {
  return (
    <nav
      aria-label="Practice navigation"
      className="practice-local-nav mx-auto mb-6 flex min-h-10 w-full max-w-5xl shrink-0 items-center gap-1 border-b px-3 py-1 text-xs sm:gap-2 sm:px-5 sm:text-sm"
    >
      <Link className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-neutral-100" href="/dashboard">
        <LayoutDashboard size={15} />
        <span>Dashboard</span>
      </Link>
      <Link className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-neutral-100" href="/questionbank">
        <LibraryBig size={15} />
        <span>Question Bank</span>
      </Link>
      <Link aria-label="Search questions" title="Search questions" className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border hover:bg-neutral-100" href="/question">
        <Search size={15} />
      </Link>
    </nav>
  );
}
