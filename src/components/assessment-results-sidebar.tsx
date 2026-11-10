"use client";

import type { ReactNode } from "react";

export type ResultsSection = "summary" | "review" | "sharing";

export function AssessmentResultsSidebar({
  active,
  onSelect,
  children,
}: {
  active: ResultsSection;
  onSelect: (section: ResultsSection) => void;
  children?: ReactNode;
}) {
  const items: Array<[ResultsSection, string]> = [
    ["summary", "Summary"],
    ["review", "Review"],
    ["sharing", "Export and sharing"],
  ];

  return (
    <aside className="assessment-results-sidebar" aria-label="Assessment results">
      <nav className="assessment-results-sidebar-nav">
        {items.map(([section, label]) => (
          <button
            key={section}
            type="button"
            aria-current={active === section ? "page" : undefined}
            className={`assessment-results-sidebar-link${active === section ? " is-active" : ""}`}
            onClick={() => onSelect(section)}
          >
            {label}
          </button>
        ))}
      </nav>
      {children}
    </aside>
  );
}
