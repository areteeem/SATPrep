"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eraser, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };
type ImageTarget = { src: string; alt: string };

const colors = ["#171717", "#dc2626", "#2563eb"];
const annotationKey = (src: string) =>
  `sat-assessment-image-annotations-v1:${src}`;
const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800";

/** Opens assessment figures in a viewport-sized viewer and stores pen marks per image URL. */
export function AssessmentImageViewer() {
  const [image, setImage] = useState<ImageTarget | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(colors[0]);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const activeStroke = useRef<Point[] | null>(null);

  const [aspect, setAspect] = useState(1.5);
  const [viewport, setViewport] = useState({ width: 900, height: 650 });
  useEffect(() => {
    const update = () =>
      setViewport({
        width: window.innerWidth - 24,
        height: window.innerHeight - 120,
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const openImage = useCallback((event: Event) => {
    if (!(event.target instanceof Element)) return;
    const root = event.target.closest(
      "[data-assessment-content], .questionProblemCard, .sat-passage, .sat-test-passage",
    );
    if (
      !root ||
      event.target.closest("[data-no-image-viewer], [data-slot=avatar]")
    )
      return;
    const target = event.target.closest("img");
    const mathSvg = event.target.closest("mjx-container svg");
    if (!target && !mathSvg) return;
    if (
      event instanceof KeyboardEvent &&
      event.key !== "Enter" &&
      event.key !== " "
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (target) {
      const src = target.currentSrc || target.getAttribute("src");
      if (!src) return;
      setAspect(
        target.naturalWidth && target.naturalHeight
          ? target.naturalWidth / target.naturalHeight
          : 1.5,
      );
      setImage({ src, alt: target.alt || "Assessment image" });
    } else if (mathSvg) {
      const svg = mathSvg.cloneNode(true) as SVGElement;
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.style.background = "white";
      svg.style.color = "black";
      const box = mathSvg.getBoundingClientRect();
      setAspect(box.width / box.height || 1.5);
      setImage({
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`,
        alt: "Expanded question formula",
      });
    }
  }, []);
  useEffect(() => {
    document.addEventListener("click", openImage, true);
    document.addEventListener("keydown", openImage, true);
    const decorate = () =>
      document
        .querySelectorAll<HTMLImageElement>(
          "[data-assessment-content] img, .questionProblemCard img",
        )
        .forEach((img) => {
          if (img.closest("[data-no-image-viewer]")) return;
          img.tabIndex = 0;
          img.setAttribute("role", "button");
          img.setAttribute(
            "aria-label",
            `Expand and annotate ${img.alt || "question image"}`,
          );
        });
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", openImage, true);
      document.removeEventListener("keydown", openImage, true);
      observer.disconnect();
    };
  }, [openImage]);

  useEffect(() => {
    if (!image) return;
    try {
      const saved = localStorage.getItem(annotationKey(image.src));
      const parsed = saved ? JSON.parse(saved) : [];
      setStrokes(Array.isArray(parsed) ? parsed : []);
    } catch {
      setStrokes([]);
    }
    activeStroke.current = null;
    setDrawing(null);
  }, [image]);

  const saveStrokes = (next: Stroke[]) => {
    setStrokes(next);
    if (!image) return;
    try {
      localStorage.setItem(annotationKey(image.src), JSON.stringify(next));
    } catch {}
  };

  const getPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
      ),
    };
  };

  const paths = useMemo(
    () =>
      strokes.map((stroke) => ({
        color: stroke.color,
        d: stroke.points
          .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
          .join(" "),
      })),
    [strokes],
  );

  return (
    <Dialog
      open={Boolean(image)}
      onOpenChange={(open) => {
        if (!open) setImage(null);
      }}
    >
      <DialogContent
        aria-label="Expanded assessment image"
        className="assessment-image-dialog fixed inset-0 left-0 top-0 z-[1000] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-3 overflow-hidden rounded-none border-0 bg-white p-3 shadow-none dark:bg-neutral-950 sm:rounded-none"
      >
        <div className="flex min-h-11 items-center justify-between gap-3 pr-10">
          <DialogTitle className="truncate text-sm font-medium">
            Annotate image
          </DialogTitle>
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Pen color"
              className="flex items-center gap-1"
            >
              {colors.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Use ${value === colors[0] ? "black" : value === colors[1] ? "red" : "blue"} pen`}
                  aria-pressed={color === value}
                  className="size-8 rounded-full border border-neutral-300 p-1 dark:border-neutral-600"
                  onClick={() => setColor(value)}
                >
                  <span
                    className="block size-full rounded-full"
                    style={{ backgroundColor: value }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Undo annotation"
              className={iconButtonClass}
              disabled={!strokes.length}
              onClick={() => saveStrokes(strokes.slice(0, -1))}
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              aria-label="Clear annotations"
              className={iconButtonClass}
              disabled={!strokes.length}
              onClick={() => saveStrokes([])}
            >
              <Eraser size={17} />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
          {image && (
            <div
              className="relative shrink-0 touch-none"
              style={{
                width: Math.min(viewport.width, viewport.height * aspect),
                height: Math.min(viewport.height, viewport.width / aspect),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                draggable={false}
                data-no-image-viewer
                className="block size-full select-none object-contain"
              />
              <svg
                aria-label="Draw annotations on image"
                role="application"
                className="absolute inset-0 size-full touch-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  activeStroke.current = [getPoint(event)];
                  setDrawing(activeStroke.current);
                }}
                onPointerMove={(event) => {
                  if (!activeStroke.current) return;
                  activeStroke.current = [
                    ...activeStroke.current,
                    getPoint(event),
                  ];
                  setDrawing(activeStroke.current);
                }}
                onPointerUp={() => {
                  if (!activeStroke.current) return;
                  const next = [
                    ...strokes,
                    { color, points: activeStroke.current },
                  ];
                  activeStroke.current = null;
                  setDrawing(null);
                  saveStrokes(next);
                }}
                onPointerCancel={() => {
                  activeStroke.current = null;
                  setDrawing(null);
                }}
              >
                {paths.map((path, index) => (
                  <path
                    key={index}
                    d={path.d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {drawing && (
                  <path
                    d={drawing
                      .map(
                        (point, index) =>
                          `${index ? "L" : "M"} ${point.x} ${point.y}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-neutral-500">
          Draw over the image. Your annotations are saved on this device.
        </p>
      </DialogContent>
    </Dialog>
  );
}
