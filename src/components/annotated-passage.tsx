"use client";

import { useEffect, useRef, useState } from "react";
import { MathJax } from "better-react-mathjax";

/** Annotations are local to a question on this device; original question HTML is never changed. */
export function AnnotatedPassage({ html, questionId, className = "" }: { html: string; questionId: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(html);
  const [message, setMessage] = useState("");
  const key = `sat-passage-annotations-v1:${questionId}`;
  useEffect(() => {
    try { setContent(localStorage.getItem(key) || html); } catch { setContent(html); }
    setMessage("");
  }, [key, html]);
  function mark(style: string) {
    const selection = window.getSelection();
    const root = ref.current;
    if (!selection || !root || selection.isCollapsed || !selection.rangeCount || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
      setMessage("Select text in the passage first."); return;
    }
    try {
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.setAttribute("style", style);
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const next = root.innerHTML;
      setContent(next);
      try { localStorage.setItem(key, next); } catch { setMessage("Could not save annotations on this device."); return; }
      setMessage("Annotation saved.");
    } catch { setMessage("This selection cannot be annotated. Try selecting a smaller passage."); }
  }
  const tools = [
    ["Yellow", "background-color: #fff1a6; color: #171717"],
    ["Green", "background-color: #ccefcf; color: #171717"],
    ["Blue", "background-color: #cde4ff; color: #171717"],
    ["Pink", "background-color: #ffd7e5; color: #171717"],
    ["Underline", "text-decoration: underline"],
    ["Double underline", "text-decoration-line: underline; text-decoration-style: double"],
  ];
  return <div className={className}>
    <div role="toolbar" aria-label="Passage annotations" className="mb-3 flex flex-wrap gap-1">{tools.map(([name,style]) => <button key={name} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>mark(style)} className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600">{name}</button>)}<button type="button" onClick={()=>{setContent(html);try { localStorage.removeItem(key); } catch {} setMessage("Annotations cleared.");}} className="rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600">Clear</button></div>
    <MathJax inline dynamic><div ref={ref} dangerouslySetInnerHTML={{__html:content}} /></MathJax>
    <span className="sr-only" aria-live="polite">{message}</span>
  </div>;
}
