"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, Maximize2, Minus, X } from "lucide-react";

export function FloatingToolWindow({
  title,
  open,
  onClose,
  children,
  wide = false,
  active = false,
  onActivate,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  active?: boolean;
  onActivate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 80 });
  const [size, setSize] = useState({
    width: wide ? 640 : 410,
    height: wide ? 560 : 580,
  });
  const dragging = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    width: number;
  } | null>(null);
  const resizing = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMounted(true);
    setPosition({
      x: wide ? 16 : Math.max(8, window.innerWidth - 430),
      y: 80,
    });
  }, [wide]);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);
  useEffect(() => {
    const element = root.current;
    if (!element || collapsed || !open) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setSize((old) =>
        Math.abs(old.width - rect.width) > 1 ||
        Math.abs(old.height - rect.height) > 1
          ? { width: rect.width, height: rect.height }
          : old,
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [collapsed, open, everOpened]);
  useEffect(() => {
    const clamp = () =>
      setPosition((old) => ({
        x: Math.max(
          0,
          Math.min(
            old.x,
            window.innerWidth - Math.min(size.width, window.innerWidth),
          ),
        ),
        y: Math.max(0, Math.min(old.y, window.innerHeight - 44)),
      }));
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [size.width]);
  if (!mounted || !everOpened) return null;
  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-label={title}
      data-tool-window
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      className="fixed flex flex-col overflow-hidden rounded-xl border border-neutral-300 bg-white text-neutral-950 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-50"
      style={{
        zIndex: active ? 170 : 160,
        display: open ? "flex" : "none",
        left: position.x,
        top: position.y,
        width: size.width,
        height: collapsed ? 44 : size.height,
        minWidth: 260,
        minHeight: collapsed ? 44 : 250,
        maxWidth: `calc(100vw - ${position.x}px - 4px)`,
        maxHeight: `calc(100dvh - ${position.y}px - 4px)`,
        resize: collapsed ? "none" : "both",
      }}
    >
      <div
        className="flex h-11 shrink-0 touch-none select-none items-center gap-2 border-b border-neutral-200 px-3 dark:border-neutral-700"
        onPointerDown={(e) => {
          if ((e.target as Element).closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = {
            x: e.clientX,
            y: e.clientY,
            startX: position.x,
            startY: position.y,
            width: root.current?.offsetWidth || 260,
          };
        }}
        onPointerMove={(e) => {
          const drag = dragging.current;
          if (!drag) return;
          setPosition({
            x: Math.max(
              0,
              Math.min(
                window.innerWidth - drag.width - 4,
                drag.startX + e.clientX - drag.x,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                window.innerHeight - 44,
                drag.startY + e.clientY - drag.y,
              ),
            ),
          });
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <GripHorizontal size={16} className="cursor-grab text-neutral-500" />
        <strong className="flex-1 text-sm">{title}</strong>
        <button
          type="button"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onClick={() => setCollapsed(!collapsed)}
          className="p-1"
        >
          {collapsed ? <Maximize2 size={16} /> : <Minus size={16} />}
        </button>
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
          className="p-1"
        >
          <X size={16} />
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto p-3"
        style={{ display: collapsed ? "none" : "block" }}
      >
        {children}
      </div>
      {!collapsed && (
        <button
          type="button"
          aria-label={`Resize ${title} window`}
          className="absolute bottom-0 right-0 flex size-6 touch-none items-center justify-center bg-white text-neutral-500 dark:bg-neutral-950"
          style={{ cursor: "nwse-resize" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = root.current?.getBoundingClientRect();
            resizing.current = {
              x: e.clientX,
              y: e.clientY,
              width: rect?.width || size.width,
              height: rect?.height || size.height,
            };
          }}
          onPointerMove={(e) => {
            const resize = resizing.current;
            if (!resize) return;
            setSize({
              width: Math.max(
                260,
                Math.min(
                  window.innerWidth - position.x - 4,
                  resize.width + e.clientX - resize.x,
                ),
              ),
              height: Math.max(
                250,
                Math.min(
                  window.innerHeight - position.y - 4,
                  resize.height + e.clientY - resize.y,
                ),
              ),
            });
          }}
          onPointerUp={() => {
            resizing.current = null;
          }}
          onPointerCancel={() => {
            resizing.current = null;
          }}
          onKeyDown={(e) => {
            if (
              !["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(
                e.key,
              )
            )
              return;
            e.preventDefault();
            setSize((old) => ({
              width: Math.max(
                260,
                Math.min(
                  window.innerWidth - position.x - 4,
                  old.width +
                    (e.key === "ArrowRight"
                      ? 20
                      : e.key === "ArrowLeft"
                        ? -20
                        : 0),
                ),
              ),
              height: Math.max(
                250,
                Math.min(
                  window.innerHeight - position.y - 4,
                  old.height +
                    (e.key === "ArrowDown"
                      ? 20
                      : e.key === "ArrowUp"
                        ? -20
                        : 0),
                ),
              ),
            }));
          }}
        >
          <Maximize2 size={12} />
        </button>
      )}
    </div>,
    document.body,
  );
}
