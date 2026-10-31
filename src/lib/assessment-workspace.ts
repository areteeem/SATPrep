import type { LocalQuestion } from "@/lib/local-assessments";
import type { Snapshot } from "@quickdrawjs/core";
export type WorkspaceQuestion = LocalQuestion & {
  module?: string;
  marked?: boolean;
  notes?: string;
};
export type WhiteboardDocument = {
  id: string;
  title: string;
  questions: WorkspaceQuestion[];
  createdAt: string;
  updatedAt?: string;
  showSolutions?: boolean;
  snapshots?: Record<string, Snapshot>;
  cameras?: Record<string, { x: number; y: number; z: number }>;
  contentWidth?: number;
  singlePage?: boolean;
};
export const domainNames: Record<string, string> = {
  INI: "Information and Ideas",
  CAS: "Craft and Structure",
  EOI: "Expression of Ideas",
  SEC: "Standard English Conventions",
  H: "Algebra",
  P: "Advanced Math",
  Q: "Problem-Solving and Data Analysis",
  S: "Geometry and Trigonometry",
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sat-whiteboards-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("boards", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function storeWhiteboard(board: WhiteboardDocument) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("boards", "readwrite");
      tx.objectStore("boards").put({ ...board, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function readWhiteboards(): Promise<WhiteboardDocument[]> {
  const db = await database();
  try {
    const boards = await new Promise<WhiteboardDocument[]>((resolve, reject) => {
      const request = db.transaction("boards").objectStore("boards").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return boards.sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
  } finally {
    db.close();
  }
}
export async function readWhiteboard(
  id: string,
): Promise<WhiteboardDocument | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("boards").objectStore("boards").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function openWhiteboard(
  title: string,
  questions: WorkspaceQuestion[],
  showSolutions = false,
  identity = title,
  singlePage = false,
) {
  const windowRef = window.open("about:blank", "_blank");
  if (!windowRef) throw new Error("Allow a new tab to open the whiteboard.");
  windowRef.opener = null;
  try {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `${identity}:${singlePage ? "single-page" : "question-pages"}:${questions.map((q) => q.id).join(",")}`,
      ),
    );
    const id = Array.from(new Uint8Array(bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
    const existing = await readWhiteboard(id);
    await storeWhiteboard({
      ...existing,
      id,
      title,
      questions,
      createdAt: existing?.createdAt || new Date().toISOString(),
      showSolutions,
      singlePage,
    });
    windowRef.location.href = `/whiteboard?board=${id}`;
  } catch (e) {
    windowRef.close();
    throw e;
  }
}
export function readReviewMarks(sessionId: string): string[] {
  try {
    return JSON.parse(
      localStorage.getItem(`sat-review-marks-v1:${sessionId}`) || "[]",
    );
  } catch {
    return [];
  }
}
export function setReviewMarks(sessionId: string, ids: string[]) {
  localStorage.setItem(`sat-review-marks-v1:${sessionId}`, JSON.stringify(ids));
  window.dispatchEvent(new Event("sat-review-marks"));
}
