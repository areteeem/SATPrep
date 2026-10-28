"use client";
import { useEffect, useState } from "react";
import { FloatingToolWindow } from "@/components/floating-tool-window";
import type { QuestionNotes } from "@/types/questionNotes";
interface DraggableNotesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  assessment: string;
  questionNotes: QuestionNotes;
  onSaveNote: (note: string) => void;
  currentNote: string;
}
export function DraggableNotesPopup({
  isOpen,
  onClose,
  questionId,
  onSaveNote,
  currentNote,
}: DraggableNotesPopupProps) {
  const [note, setNote] = useState(currentNote);
  useEffect(() => setNote(currentNote), [questionId, currentNote]);
  useEffect(() => {
    if (!isOpen || note === currentNote) return;
    const timer = setTimeout(() => onSaveNote(note), 400);
    return () => clearTimeout(timer);
  }, [note, isOpen, currentNote, onSaveNote]);
  return (
    <FloatingToolWindow
      title="Question notes"
      open={isOpen}
      onClose={() => {
        if (note !== currentNote) onSaveNote(note);
        onClose();
      }}
      active
    >
      <label className="flex h-full flex-col gap-3 text-sm">
        Notes for this question
        <textarea
          className="min-h-60 flex-1 resize-none rounded-xl border bg-transparent p-3"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Your working, observations, or teaching notes…"
        />
        <span className="text-xs text-neutral-500">Saved automatically</span>
      </label>
    </FloatingToolWindow>
  );
}
