"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import { MathJax } from "better-react-mathjax";
import { Quickdraw } from "@quickdrawjs/react";
import { pageBounds } from "@quickdrawjs/core";
import type { Editor, Snapshot } from "@quickdrawjs/core";
import type { QuickdrawRef } from "@quickdrawjs/react";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  FileDown,
  Eye,
  EyeOff,
  Upload,
} from "lucide-react";
import { assessmentButton as button } from "@/components/assessment-controls";
import { AssessmentWorkspaceActions } from "@/components/assessment-workspace-actions";
import { hasAssessmentContent } from "@/components/assessment-controls";
import type {
  WhiteboardDocument,
  WorkspaceQuestion,
} from "@/lib/assessment-workspace";
import { storeWhiteboard } from "@/lib/assessment-workspace";
import { domainNames } from "@/lib/assessment-workspace";
import { fillQuestionBlank } from "@/lib/assessment-blanks";
import "@quickdrawjs/core/quickdraw.css";

function safeHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,foreignObject",
    )
    .forEach((element) => element.remove());
  doc.querySelectorAll("*").forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      if (
        /^on/i.test(attr.name) ||
        attr.name === "srcdoc" ||
        (["href", "src", "xlink:href"].includes(attr.name) &&
          /^\s*(javascript:|vbscript:|data:(?!image\/(png|jpeg|gif|webp);))/i.test(
            attr.value,
          ))
      )
        element.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}

function correct(question: WorkspaceQuestion, key: string) {
  return Boolean(
    (question.detail?.correct_answer || question.correctAnswers)?.includes(key),
  );
}

export default function AssessmentWhiteboard({
  board: initialBoard,
  initialQuestionId,
}: {
  board: WhiteboardDocument;
  initialQuestionId?: string;
}) {
  const quickdraw = useRef<QuickdrawRef | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const boardRef = useRef(initialBoard);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [board, setBoard] = useState(initialBoard);
  const [index, setIndex] = useState(() => Math.max(0, initialBoard.questions.findIndex((q) => q.id === initialQuestionId)));
  const [tool, setTool] = useState("hand");
  const [showAnswer, setShowAnswer] = useState(false);
  const [bounds, setBounds] = useState({ x: -20, y: -20, w: 1120, h: 760 });
  const [viewport, setViewport] = useState({ x: -20, y: -20, w: 1120, h: 760 });
  const [hitboxes, setHitboxes] = useState<Array<{ x: number; y: number; w: number; h: number }>>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const questionIdRef = useRef(initialBoard.questions[index]?.id || initialBoard.id);
  const mountCleanup = useRef<(() => void) | null>(null);
  const [canvasHost, setCanvasHost] = useState<HTMLElement | null>(null);
  const [contentWidth, setContentWidth] = useState(initialBoard.contentWidth || 1120);
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const question = board.questions[index];
  const detail = question?.detail;
  const hasStimulus = question ? hasAssessmentContent(detail?.stimulus) : false;
  const answers = useMemo(
    () => Object.entries(detail?.answerOptions || {}),
    [detail?.answerOptions],
  );

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const updateViewport = useCallback((editor: Editor) => {
    const camera = editor.camera;
    const content = contentRef.current;
    if (content) {
      content.style.transform = `translate(${camera.x * camera.z}px, ${camera.y * camera.z}px) scale(${camera.z})`;
    }
    if (sceneRef.current) {
      sceneRef.current.style.backgroundSize = `${80 * camera.z}px ${80 * camera.z}px`;
      sceneRef.current.style.backgroundPosition = `${camera.x * camera.z}px ${camera.y * camera.z}px`;
    }
    const live = editor.contentBounds();
    const width = content?.offsetWidth || boardRef.current.contentWidth || 1120;
    const height = content?.offsetHeight || 760;
    const left = Math.min(0, live?.x || 0);
    const top = Math.min(0, live?.y || 0);
    const right = Math.max(width, live ? live.x + live.w : 0);
    const bottom = Math.max(height, live ? live.y + live.h : 0);
    setBounds({ x: left - 80, y: top - 80, w: right - left + 160, h: bottom - top + 160 });
    setViewport(editor.viewportPageBounds());
  }, []);

  const saveSnapshot = useCallback((editor: Editor, questionId = questionIdRef.current) => {
    if (!questionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const snapshot = editor.store.getSnapshot();
    const camera = { ...editor.camera };
    saveTimer.current = setTimeout(() => {
      const current = boardRef.current;
      const updated = {
        ...current,
        snapshots: { ...current.snapshots, [questionId]: snapshot },
        cameras: { ...current.cameras, [questionId]: camera },
      };
      boardRef.current = updated;
      setBoard(updated);
      void storeWhiteboard(updated);
    }, 250);
  }, []);

  const mount = useCallback((editor: Editor) => {
    mountCleanup.current?.();
    editor.container.style.background = "transparent";
    editor.canvas.style.zIndex = "20";
    editor.overlay.style.zIndex = "21";
    const toolbox = editor.container.querySelector<HTMLElement>(".qd-ui");
    toolbox?.style.setProperty("z-index", "100", "important");
    const screenContext = editor.canvas.getContext("2d");
    const renderScene = editor.renderScene.bind(editor);
    editor.renderScene = (context, camera, width, height, options) =>
      renderScene(context, camera, width, height, {
        ...options,
        ...(context === screenContext ? { background: false } : {}),
      });
    const drawingBounds = editor.contentBounds.bind(editor);
    editor.contentBounds = () => {
      const ink = drawingBounds();
      const width = contentRef.current?.offsetWidth || boardRef.current.contentWidth || 1120;
      const height = contentRef.current?.offsetHeight || 760;
      const x = Math.min(0, ink?.x || 0);
      const y = Math.min(0, ink?.y || 0);
      return {
        x,
        y,
        w: Math.max(width, ink ? ink.x + ink.w : 0) - x,
        h: Math.max(height, ink ? ink.y + ink.h : 0) - y,
      };
    };
    const width = boardRef.current.contentWidth || Math.min(1500, Math.max(320, editor.viewSize().w));
    boardRef.current = { ...boardRef.current, contentWidth: width };
    setBoard(boardRef.current);
    setContentWidth(width);
    setCanvasHost(editor.container);
    const labelExports = () => {
      toolbox?.querySelectorAll<HTMLElement>(".qd-mi-label").forEach((label) => {
        if (label.textContent === "Export as PNG") label.textContent = "Export as PDF";
        if (label.textContent === "Export — transparent" || label.textContent === "Export selection") {
          const row = label.closest<HTMLElement>("button");
          if (row) row.hidden = true;
        }
      });
    };
    const menuObserver = new MutationObserver(labelExports);
    if (toolbox) menuObserver.observe(toolbox, { childList: true, subtree: true });
    const currentId = questionIdRef.current;
    if (currentId && boardRef.current.snapshots?.[currentId]) {
      editor.store.loadSnapshot(boardRef.current.snapshots[currentId], "remote");
    }
    editor.setCamera(currentId && boardRef.current.cameras?.[currentId] || { x: 0, y: 0, z: 1 });
    editor.setTool("hand");
    setTool("hand");

    // The ink stays above the HTML. Route Select clicks to the controls below it;
    // all other gestures continue through QuickDraw's normal input handling.
    const selectControl = (event: globalThis.PointerEvent) => {
      if (editor.tool !== "select" || event.button !== 0 || event.target !== editor.canvas) return;
      const control = Array.from(contentRef.current?.querySelectorAll<HTMLElement>("[data-whiteboard-control]") || []).find((element) => {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      if (!control) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      control.focus({ preventScroll: true });
      control.click();
    };
    editor.container.addEventListener("pointerdown", selectControl, true);
    const stopTool = editor.on("tool", () => setTool(editor.tool));
    const stopCamera = editor.on("camera", () => {
      updateViewport(editor);
      saveSnapshot(editor);
    });
    const updateHitboxes = () => setHitboxes(editor.store.shapes().map(pageBounds));
    const stopShapes = editor.store.listen(updateHitboxes);
    updateHitboxes();
    updateViewport(editor);
    mountCleanup.current = () => {
      stopTool();
      stopCamera();
      stopShapes();
      menuObserver.disconnect();
      editor.container.removeEventListener("pointerdown", selectControl, true);
    };
  }, [saveSnapshot, updateViewport]);

  useEffect(() => {
    if (!canvasHost || !contentRef.current) return;
    const editor = quickdraw.current?.editor;
    if (!editor) return;
    const observer = new ResizeObserver(() => updateViewport(editor));
    observer.observe(contentRef.current);
    updateViewport(editor);
    return () => observer.disconnect();
  }, [canvasHost, contentWidth, updateViewport]);

  useEffect(() => () => {
    mountCleanup.current?.();
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  function selectQuestion(next: number) {
    const editor = quickdraw.current?.editor;
    if (!editor || next < 0 || next >= board.questions.length || next === index)
      return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const currentId = board.questions[index].id;
    const nextId = board.questions[next].id;
    const snapshot = editor.store.getSnapshot();
    const updated = {
      ...boardRef.current,
      snapshots: { ...boardRef.current.snapshots, [currentId]: snapshot },
      cameras: { ...boardRef.current.cameras, [currentId]: { ...editor.camera } },
    };
    boardRef.current = updated;
    setBoard(updated);
    void storeWhiteboard(updated);
    editor.store.loadSnapshot(updated.snapshots?.[nextId] || { document: { store: {} } }, "remote");
    questionIdRef.current = nextId;
    setIndex(next);
    setShowAnswer(false);
    requestAnimationFrame(() => {
      editor.setCamera(updated.cameras?.[nextId] || { x: 0, y: 0, z: 1 });
      updateViewport(editor);
    });
  }

  function chooseAnswer(key: string) {
    setBoard((current) => {
      const updated = {
        ...current,
        questions: current.questions.map((q, i) =>
          i === index ? { ...q, answer: key } : q,
        ),
      };
      boardRef.current = updated;
      void storeWhiteboard(updated);
      return updated;
    });
  }

  async function saveBoard() {
    const editor = quickdraw.current?.editor;
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const snapshotKey = boardRef.current.questions[index]?.id || boardRef.current.id;
    const updated = {
      ...boardRef.current,
      cameras: { ...boardRef.current.cameras, [snapshotKey]: { ...editor.camera } },
      snapshots: {
        ...boardRef.current.snapshots,
        [snapshotKey]: editor.store.getSnapshot(),
      },
    };
    await storeWhiteboard(updated);
    boardRef.current = updated;
    setBoard(updated);
    setMessage("Board saved on this device.");
  }

  async function exportPdf() {
    const editor = quickdraw.current?.editor;
    const content = contentRef.current;
    if (!editor || !content || exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setMessage("Preparing PDF…");
    try {
      const [{ toCanvas }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      await document.fonts.ready;
      const bounds = editor.contentBounds()!;
      const margin = 24;
      const width = Math.ceil(bounds.w + margin * 2);
      const height = Math.ceil(bounds.h + margin * 2);
      const ratio = Math.min(2, 8192 / Math.max(width, height));
      const questionCanvas = await toCanvas(content, {
        pixelRatio: ratio,
        width: content.offsetWidth,
        height: content.offsetHeight,
        skipFonts: true,
        fontEmbedCSS: "",
        style: { transform: "none", transformOrigin: "0 0" },
        filter: (node) => !(node instanceof HTMLElement && node.hasAttribute("data-whiteboard-export-hidden")),
      });
      const output = document.createElement("canvas");
      output.width = Math.ceil(width * ratio);
      output.height = Math.ceil(height * ratio);
      const context = output.getContext("2d");
      if (!context) throw new Error("PDF image rendering is unavailable.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(questionCanvas, (margin - bounds.x) * ratio, (margin - bounds.y) * ratio);
      const ink = document.createElement("canvas");
      ink.width = output.width;
      ink.height = output.height;
      const inkContext = ink.getContext("2d");
      if (!inkContext) throw new Error("PDF drawing rendering is unavailable.");
      editor.renderScene(inkContext, { x: margin - bounds.x, y: margin - bounds.y, z: 1 }, width, height, { dpr: ratio, background: false });
      context.drawImage(ink, 0, 0);
      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
        compress: true,
      });
      pdf.addImage(output.toDataURL("image/png"), "PNG", 0, 0, width, height);
      await pdf.save(`${boardRef.current.title.replace(/[^a-z0-9]+/gi, "-")}.pdf`, { returnPromise: true });
      setMessage(
        boardRef.current.questions.length
          ? "PDF downloaded with the question and drawings."
          : "PDF downloaded.",
      );
    } catch (error) {
      setMessage(`Could not create the PDF. ${error instanceof Error ? error.message : "Please try again."}`);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }

  function saveJson() {
    const editor = quickdraw.current?.editor;
    const snapshots = {
      ...board.snapshots,
      ...(editor
        ? { [board.questions[index]?.id || board.id]: editor.store.getSnapshot() }
        : {}),
    };
    const blob = new Blob(
      [JSON.stringify({ format: "sat-whiteboard-v2", board: { ...board, snapshots } })],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${board.title.replace(/[^a-z0-9]+/gi, "-")}.satboard.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 25_000_000) throw new Error("This board is too large.");
      const saved = JSON.parse(await file.text());
      const imported = saved.board;
      if (
        !imported ||
        !Array.isArray(imported.questions) ||
        imported.questions.length > 500
      )
        throw new Error("Choose a SAT whiteboard export with questions.");
      const snapshots: Record<string, Snapshot> = {};
      for (const q of imported.questions) {
        const snapshot = imported.snapshots?.[q.id];
        if (snapshot?.document?.store) snapshots[q.id] = snapshot;
      }
      const updated: WhiteboardDocument = {
        ...imported,
        id: board.id,
        snapshots,
      };
      await storeWhiteboard(updated);
      boardRef.current = updated;
      setBoard(updated);
      const nextIndex = Math.min(index, Math.max(0, updated.questions.length - 1));
      setIndex(nextIndex);
      const nextId = updated.questions[nextIndex]?.id || updated.id;
      questionIdRef.current = nextId;
      setContentWidth(updated.contentWidth || contentWidth);
      quickdraw.current?.editor?.store.loadSnapshot(
        snapshots[nextId] || { document: { store: {} } },
        "remote",
      );
      quickdraw.current?.editor?.setCamera(updated.cameras?.[nextId] || { x: 0, y: 0, z: 1 });
      setMessage("Board imported.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not import this board.",
      );
    }
  }

  function navigateMap(event: MouseEvent<HTMLDivElement>) {
    const editor = quickdraw.current?.editor;
    if (!editor) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pageX = bounds.x + ((event.clientX - rect.left) / rect.width) * bounds.w;
    const pageY = bounds.y + ((event.clientY - rect.top) / rect.height) * bounds.h;
    const view = editor.viewSize();
    editor.setCamera(
      {
        z: editor.camera.z,
        x: view.w / 2 / editor.camera.z - pageX,
        y: view.h / 2 / editor.camera.z - pageY,
      },
      { animate: 100 },
    );
  }

  const detailPane = (
    <div
      ref={contentRef}
      className="sat-quickdraw-world"
      style={{ position: "absolute", left: 0, top: 0, zIndex: 10, width: contentWidth, transformOrigin: "0 0", pointerEvents: "none", padding: "20px 32px" }}
      aria-label={question ? "Question content" : undefined}
    >
      {question && <div className="sat-quickdraw-question-inner">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {domainNames[question.domain] || question.domain} · {question.module || "Question"}
            </p>
            {question.skill && <p className="mt-1 text-xs text-neutral-500">{question.skill}</p>}
          </div>
          <button
            type="button"
            className={`${button} shrink-0 p-2`}
            data-whiteboard-control
            data-whiteboard-export-hidden
            aria-label={showAnswer ? "Hide correct answer" : "Show correct answer"}
            title={showAnswer ? "Hide correct answer" : "Show correct answer"}
            onClick={() => setShowAnswer((shown) => !shown)}
          >
            {showAnswer ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>
        <div className={hasStimulus ? "grid gap-6" : "mx-auto max-w-4xl"} style={hasStimulus ? { gridTemplateColumns: contentWidth >= 900 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)" } : undefined}>
          {hasStimulus && (
            <div>
              <MathJax dynamic>
              <div
                className="sat-quickdraw-passage rounded-xl border bg-white/95 p-5 text-base leading-7"
                dangerouslySetInnerHTML={{ __html: safeHtml(fillQuestionBlank(detail?.stimulus || "", detail?.answerOptions, question.answer)) }}
              />
              </MathJax>
            </div>
          )}
          <div
            className="rounded-xl border bg-white/95 p-5 text-base leading-7"
          >
            <MathJax dynamic>
              <div dangerouslySetInnerHTML={{ __html: safeHtml(fillQuestionBlank(detail?.stem || "Question content unavailable.", detail?.answerOptions, question.answer)) }} />
            </MathJax>
            {answers.length ? (
              <div className="mt-5 grid gap-3">
                {answers.map(([key, html], optionIndex) => {
                  const isCorrect = showAnswer && correct(question, key);
                  const isSelected = question.answer === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      data-whiteboard-control
                      className={`flex min-h-12 w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm ${isCorrect ? "border-green-700 bg-green-50" : isSelected ? "border-neutral-900 bg-neutral-100" : "bg-white"}`}
                      onClick={() => chooseAnswer(key)}
                      title="Select this answer while the Select tool is active"
                    >
                      <span className="font-semibold">{String.fromCharCode(65 + optionIndex)}</span>
                      <MathJax inline dynamic>
                        <span dangerouslySetInnerHTML={{ __html: safeHtml(html) }} />
                      </MathJax>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                <label className="block text-xs font-medium text-neutral-500" htmlFor="whiteboard-open-answer">Open response</label>
                <input id="whiteboard-open-answer" className="pointer-events-auto w-full rounded-lg border bg-white px-3 py-2" value={question.answer || ""} readOnly />
                {showAnswer && <p className="text-sm"><strong>Correct answer:</strong> {detail?.correct_answer?.join(", ") || "Unavailable"}</p>}
              </div>
            )}
            {showAnswer && detail?.rationale && (
              <div className="mt-4 border-t pt-4 text-sm leading-6" dangerouslySetInnerHTML={{ __html: safeHtml(detail.rationale) }} />
            )}
          </div>
        </div>
      </div>}
    </div>
  );

  return (
    <main className="sat-quickdraw-app fixed inset-0 z-[110] flex flex-col bg-white text-neutral-950">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-white px-3 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{board.title}</h1>
          <p className="text-xs text-neutral-500">{question ? "Drag with Hand to move the whole board. Use Select for answers, or Draw to annotate." : "Draw freely on the blank canvas."}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button className={`${button} p-2`} title="Save board" aria-label="Save board" onClick={() => void saveBoard()}><Save size={17} /></button>
          <button className={`${button} gap-2 px-3 py-2`} title="Download board as PDF" aria-label="Download board as PDF" disabled={exporting} onClick={() => void exportPdf()}><FileDown size={17} /><span>{exporting ? "Exporting…" : "PDF"}</span></button>
          <button className={`${button} p-2`} title="Import board" aria-label="Import board" onClick={() => importInput.current?.click()}><Upload size={17} /></button>
          {board.questions.length > 0 && (
            <select className={`${button} max-w-44 px-2`} aria-label="Choose question" value={index} onChange={(event) => selectQuestion(Number(event.target.value))}>
              {board.questions.map((q, i) => <option key={q.id} value={i}>{i + 1}. {domainNames[q.domain] || q.domain}</option>)}
            </select>
          )}
        </div>
      </header>
      <input ref={importInput} hidden type="file" accept=".json,.satboard" onChange={(event) => { void importJson(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      {message && <p role="status" className="shrink-0 border-b px-3 py-1 text-xs">{message}</p>}
        <div ref={sceneRef} data-tool={tool} className="sat-quickdraw-scene relative min-h-0 flex-1 overflow-hidden">
          <Quickdraw
            ref={quickdraw}
            theme="light"
            grid="lines"
            watermark={false}
            autoFit={false}
            snapshot={board.snapshots?.[question?.id || board.id]}
            onMount={mount}
            onSave={() => void exportPdf()}
            onChange={(_diff, source, editor) => {
              if (source === "user") {
                updateViewport(editor);
                saveSnapshot(editor);
              }
            }}
            style={{ width: "100%", height: "100%" }}
          />
        {canvasHost && createPortal(detailPane, canvasHost)}
        <div className="sat-quickdraw-map" onClick={navigateMap} role="button" tabIndex={0} aria-label="Whiteboard overview map" title="Click the map to move the canvas">
          {hitboxes.map((hitbox, index) => (
            <div
              key={index}
              className="sat-quickdraw-map-hitbox"
              aria-hidden="true"
              style={{
                left: `${((hitbox.x - bounds.x) / bounds.w) * 100}%`,
                top: `${((hitbox.y - bounds.y) / bounds.h) * 100}%`,
                width: `${(hitbox.w / bounds.w) * 100}%`,
                height: `${(hitbox.h / bounds.h) * 100}%`,
              }}
            />
          ))}
          <div className="sat-quickdraw-map-content" style={{ left: `${Math.max(0, ((viewport.x - bounds.x) / bounds.w) * 100)}%`, top: `${Math.max(0, ((viewport.y - bounds.y) / bounds.h) * 100)}%`, width: `${Math.min(100, Math.max(10, (viewport.w / bounds.w) * 100))}%`, height: `${Math.min(100, Math.max(10, (viewport.h / bounds.h) * 100))}%` }} />
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-white p-2">
        {board.questions.length > 0 ? (
          <button className={`${button} p-2`} disabled={index === 0} aria-label="Previous question" title="Previous question" onClick={() => selectQuestion(index - 1)}><ArrowLeft size={18} /></button>
        ) : <span />}
        <div className="flex items-center gap-2">
          {question && <AssessmentWorkspaceActions notesOnly sessionId={`whiteboard:${board.id}`} question={question} questions={[]} title={board.title} />}
        </div>
        {board.questions.length > 0 ? (
          <button className={`${button} p-2`} disabled={index === board.questions.length - 1} aria-label="Next question" title="Next question" onClick={() => selectQuestion(index + 1)}><ArrowRight size={18} /></button>
        ) : <span />}
      </footer>
    </main>
  );
}
