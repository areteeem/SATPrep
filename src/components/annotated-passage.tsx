"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { MathJax } from "better-react-mathjax";
import {
  Highlighter,
  Minus,
  Underline as UnderlineIcon,
  X,
} from "lucide-react";

const AnnotatedMarkup = memo(function AnnotatedMarkup({
  html,
  passageRef,
  onSelection,
}: {
  html: string;
  passageRef: RefObject<HTMLDivElement | null>;
  onSelection: () => void;
}) {
  return (
    <MathJax inline dynamic>
      <div
        ref={passageRef}
        onMouseUp={onSelection}
        onTouchEnd={onSelection}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </MathJax>
  );
});

/** Annotations are local to a question on this device; original question HTML is never changed. */
function AnnotatedPassageView({
  html,
  questionId,
  className = "",
}: {
  html: string;
  questionId: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selectionRange = useRef<Range | null>(null);
  const [content, setContent] = useState(html);
  const [message, setMessage] = useState("");
  const [popover, setPopover] = useState<{
    x: number;
    y: number;
    highlightOptions: boolean;
  } | null>(null);
  const key = `sat-passage-annotations-v1:${questionId}`;
  useEffect(() => {
    try {
      setContent(localStorage.getItem(key) || html);
    } catch {
      setContent(html);
    }
    setMessage("");
    setPopover(null);
    selectionRange.current = null;
  }, [key, html]);
  useEffect(() => {
    const dismissClearedSelection = () => {
      const selection = window.getSelection();
      if (
        selectionRange.current &&
        (!selection ||
          selection.isCollapsed ||
          !ref.current?.contains(selection.anchorNode))
      ) {
        selectionRange.current = null;
        setPopover(null);
      }
    };
    document.addEventListener("selectionchange", dismissClearedSelection);
    return () =>
      document.removeEventListener("selectionchange", dismissClearedSelection);
  }, []);
  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    const root = ref.current;
    if (
      !selection ||
      !root ||
      selection.isCollapsed ||
      !selection.rangeCount ||
      !root.contains(selection.anchorNode) ||
      !root.contains(selection.focusNode)
    )
      return;
    const range = selection.getRangeAt(0).cloneRange();
    const rect = range.getBoundingClientRect();
    selectionRange.current = range;
    setPopover({
      x: Math.max(
        150,
        Math.min(window.innerWidth - 150, rect.left + rect.width / 2),
      ),
      y: Math.max(12, rect.top),
      highlightOptions: false,
    });
  }, []);
  function mark(style: string) {
    const root = ref.current;
    const range = selectionRange.current;
    if (
      !root ||
      !range ||
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      setMessage("Select text in the passage first.");
      return;
    }
    try {
      const span = document.createElement("span");
      span.setAttribute("style", style);
      span.appendChild(range.extractContents());
      range.insertNode(span);
      window.getSelection()?.removeAllRanges();
      selectionRange.current = null;
      setPopover(null);
      const next = root.innerHTML;
      setContent(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        setMessage("Could not save annotations on this device.");
        return;
      }
      setMessage("Annotation saved.");
    } catch {
      setMessage(
        "This selection cannot be annotated. Try selecting a smaller passage.",
      );
    }
  }
  return (
    <div className={className}>
      <AnnotatedMarkup
        html={content}
        passageRef={ref}
        onSelection={handleSelection}
      />
      {popover && (
        <div
          role="dialog"
          aria-label="Format selected passage text"
          className="fixed z-[100] w-72 -translate-x-1/2 rounded-xl border border-neutral-300 bg-white p-3 text-neutral-950 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
          style={{
            left: popover.x,
            top: popover.y > 130 ? popover.y - 118 : popover.y + 24,
          }}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              How should this look?
            </p>
            <button
              type="button"
              aria-label="Close formatting options"
              className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => {
                setPopover(null);
                selectionRange.current = null;
                window.getSelection()?.removeAllRanges();
              }}
            >
              <X size={14} />
            </button>
          </div>
          {!popover.highlightOptions ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg border border-neutral-200 px-2 py-2 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() =>
                  setPopover((p) => (p ? { ...p, highlightOptions: true } : p))
                }
              >
                <Highlighter size={16} />
                Highlight
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg border border-neutral-200 px-2 py-2 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => mark("text-decoration: underline")}
              >
                <UnderlineIcon size={16} />
                Underline
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1 rounded-lg border border-neutral-200 px-2 py-2 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => mark("text-decoration: line-through")}
              >
                <Minus size={16} />
                Cross out
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm">Choose a highlight color</p>
              <div className="flex gap-2">
                {[
                  ["Yellow", "#fff1a6"],
                  ["Green", "#ccefcf"],
                  ["Blue", "#cde4ff"],
                  ["Pink", "#ffd7e5"],
                ].map(([name, color]) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`${name} highlight`}
                    title={`${name} highlight`}
                    className="size-8 rounded-full border border-neutral-300"
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      mark(`background-color: ${color}; color: #171717`)
                    }
                  />
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className="mt-2 w-full rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              setContent(html);
              try {
                localStorage.removeItem(key);
              } catch {}
              selectionRange.current = null;
              setPopover(null);
              setMessage("Annotations cleared.");
            }}
          >
            Clear annotations
          </button>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

// The timed full-test clock updates independently, so an active text selection is not replaced on every tick.
export const AnnotatedPassage = memo(AnnotatedPassageView);
