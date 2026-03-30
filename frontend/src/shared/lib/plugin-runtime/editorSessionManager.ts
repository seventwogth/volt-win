import type { Editor } from '@tiptap/react';
import { readFile, writeFile } from '@shared/api/file';
import { getEditorState, subscribeToEditorState } from './editorBridge';

export interface EditorSessionRange {
  from: number;
  to: number;
}

export interface EditorSessionAnchorOptions {
  from?: number;
  to?: number;
  bias?: 'start' | 'end';
}

export interface PluginEditorSession {
  id: string;
  filePath: string;
  getMarkdown(): string;
  save(): Promise<void>;
  dispose(): void;
  onDidChange(callback: () => void): () => void;
  getSelection(): EditorSessionRange;
  createAnchor(options?: EditorSessionAnchorOptions): string;
  getAnchorRange(anchorId: string): EditorSessionRange | null;
  insertAtAnchor(anchorId: string, text: string): void;
  replaceRange(range: EditorSessionRange, text: string): void;
  removeAnchor(anchorId: string): void;
}

interface SessionAnchor {
  id: string;
  from: number;
  to: number;
  bias: 'start' | 'end';
}

interface InternalEditorSession {
  id: string;
  pluginId: string;
  voltPath: string;
  filePath: string;
  markdown: string;
  selection: EditorSessionRange;
  anchors: Map<string, SessionAnchor>;
  changeListeners: Set<() => void>;
  attachedEditor: Editor | null;
  attachedUpdateHandler: (() => void) | null;
  suppressAttachedSync: boolean;
  pendingSaveTimer: ReturnType<typeof setTimeout> | null;
  saveChain: Promise<void>;
  disposed: boolean;
}

const sessions = new Map<string, InternalEditorSession>();
const pluginSessions = new Map<string, Set<string>>();
let bridgeUnsubscribe: (() => void) | null = null;

function getEditorMarkdown(editor: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((editor.storage as any).markdown?.getMarkdown?.() ?? '') as string;
}

function getMarkdownSerializer(
  editor: Editor,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): { serialize: (content: any) => string } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((editor.storage as any).markdown?.serializer ?? null) as { serialize: (content: unknown) => string } | null;
}

function serializeMarkdownSlice(editor: Editor, from: number, to: number): string {
  const serializer = getMarkdownSerializer(editor);
  if (!serializer) {
    throw new Error('Markdown serializer is not available');
  }

  return serializer.serialize(editor.state.doc.slice(from, to).content);
}

function pmPositionToMarkdownOffset(editor: Editor, position: number): number {
  return serializeMarkdownSlice(editor, 0, position).length;
}

function markdownOffsetToPmPosition(editor: Editor, offset: number): number {
  const target = Math.max(0, offset);
  const docSize = editor.state.doc.content.size;
  let low = 0;
  let high = docSize;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const currentOffset = pmPositionToMarkdownOffset(editor, mid);
    if (currentOffset < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function clampRange(markdown: string, from: number, to: number): EditorSessionRange {
  const max = markdown.length;
  const normalizedFrom = Math.max(0, Math.min(from, max));
  const normalizedTo = Math.max(0, Math.min(to, max));
  if (normalizedFrom <= normalizedTo) {
    return { from: normalizedFrom, to: normalizedTo };
  }
  return { from: normalizedTo, to: normalizedFrom };
}

function getCurrentSelection(editor: Editor): EditorSessionRange {
  const selection = editor.state.selection;
  return {
    from: pmPositionToMarkdownOffset(editor, selection.from),
    to: pmPositionToMarkdownOffset(editor, selection.to),
  };
}

function findMarkdownChange(previous: string, next: string): {
  start: number;
  oldEnd: number;
  newEnd: number;
} | null {
  if (previous === next) {
    return null;
  }

  let start = 0;
  const maxStart = Math.min(previous.length, next.length);
  while (start < maxStart && previous[start] === next[start]) {
    start += 1;
  }

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (
    previousEnd > start &&
    nextEnd > start &&
    previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return {
    start,
    oldEnd: previousEnd,
    newEnd: nextEnd,
  };
}

function remapOffset(
  offset: number,
  start: number,
  oldEnd: number,
  newEnd: number,
  assoc: -1 | 1,
): number {
  if (offset < start) {
    return offset;
  }

  if (offset > oldEnd) {
    return offset + (newEnd - oldEnd);
  }

  if (offset === start && assoc < 0) {
    return start;
  }

  if (offset === oldEnd && assoc > 0) {
    return newEnd;
  }

  return assoc < 0 ? start : newEnd;
}

function remapSessionState(
  session: InternalEditorSession,
  start: number,
  oldEnd: number,
  newEnd: number,
): void {
  for (const anchor of session.anchors.values()) {
    const collapsed = anchor.from === anchor.to;
    const collapsedAssoc: -1 | 1 = anchor.bias === 'start' ? -1 : 1;
    anchor.from = remapOffset(anchor.from, start, oldEnd, newEnd, collapsed ? collapsedAssoc : -1);
    anchor.to = remapOffset(anchor.to, start, oldEnd, newEnd, collapsed ? collapsedAssoc : 1);
  }

  session.selection = {
    from: remapOffset(session.selection.from, start, oldEnd, newEnd, -1),
    to: remapOffset(session.selection.to, start, oldEnd, newEnd, 1),
  };
}

function emitSessionChange(session: InternalEditorSession): void {
  for (const listener of session.changeListeners) {
    try {
      listener();
    } catch (err) {
      console.error(`[editorSession] Change listener failed for "${session.id}":`, err);
    }
  }
}

function queueSessionSave(session: InternalEditorSession): Promise<void> {
  session.saveChain = session.saveChain
    .catch(() => undefined)
    .then(async () => {
      await writeFile(session.voltPath, session.filePath, session.markdown);
    });

  return session.saveChain;
}

function scheduleSessionSave(session: InternalEditorSession, delayMs = 150): void {
  if (session.pendingSaveTimer) {
    clearTimeout(session.pendingSaveTimer);
  }

  session.pendingSaveTimer = setTimeout(() => {
    session.pendingSaveTimer = null;
    void queueSessionSave(session);
  }, delayMs);
}

function syncSessionToAttachedEditor(session: InternalEditorSession): void {
  const editor = session.attachedEditor;
  if (!editor || (editor as Editor & { isDestroyed?: boolean }).isDestroyed) {
    return;
  }

  session.suppressAttachedSync = true;
  editor.commands.setContent(session.markdown);
}

function applyDetachedTextChange(
  session: InternalEditorSession,
  from: number,
  to: number,
  text: string,
): void {
  const range = clampRange(session.markdown, from, to);
  session.markdown = `${session.markdown.slice(0, range.from)}${text}${session.markdown.slice(range.to)}`;
  remapSessionState(session, range.from, range.to, range.from + text.length);
  session.selection = { from: range.from + text.length, to: range.from + text.length };
  scheduleSessionSave(session);
  emitSessionChange(session);
}

function applyAttachedEditorChange(
  session: InternalEditorSession,
  from: number,
  to: number,
  text: string,
): boolean {
  const editor = session.attachedEditor;
  if (!editor || (editor as Editor & { isDestroyed?: boolean }).isDestroyed) {
    return false;
  }

  try {
    const range = clampRange(session.markdown, from, to);
    const pmFrom = markdownOffsetToPmPosition(editor, range.from);
    const pmTo = markdownOffsetToPmPosition(editor, range.to);
    const inserted = editor.commands.insertContentAt({ from: pmFrom, to: pmTo }, text);
    if (!inserted) {
      return false;
    }
    scheduleSessionSave(session);
    return true;
  } catch {
    return false;
  }
}

function applyTextChange(
  session: InternalEditorSession,
  from: number,
  to: number,
  text: string,
): void {
  if (applyAttachedEditorChange(session, from, to, text)) {
    return;
  }

  applyDetachedTextChange(session, from, to, text);
  syncSessionToAttachedEditor(session);
}

function detachSession(session: InternalEditorSession): void {
  if (session.attachedEditor && session.attachedUpdateHandler) {
    session.attachedEditor.off('update', session.attachedUpdateHandler);
  }

  session.attachedEditor = null;
  session.attachedUpdateHandler = null;
}

function attachSession(session: InternalEditorSession, editor: Editor): void {
  if (session.attachedEditor === editor) {
    return;
  }

  detachSession(session);
  session.attachedEditor = editor;

  const handleEditorUpdate = () => {
    if (session.disposed) {
      return;
    }

    const nextMarkdown = getEditorMarkdown(editor);
    if (session.suppressAttachedSync) {
      session.suppressAttachedSync = false;
      session.markdown = nextMarkdown;
      session.selection = getCurrentSelection(editor);
      emitSessionChange(session);
      return;
    }

    const change = findMarkdownChange(session.markdown, nextMarkdown);
    if (change) {
      remapSessionState(session, change.start, change.oldEnd, change.newEnd);
      session.markdown = nextMarkdown;
      session.selection = getCurrentSelection(editor);
      emitSessionChange(session);
      return;
    }

    session.selection = getCurrentSelection(editor);
  };

  session.attachedUpdateHandler = handleEditorUpdate;
  editor.on('update', handleEditorUpdate);

  const editorMarkdown = getEditorMarkdown(editor);
  if (editorMarkdown !== session.markdown) {
    syncSessionToAttachedEditor(session);
    return;
  }

  session.selection = getCurrentSelection(editor);
}

function syncSessionAttachment(session: InternalEditorSession): void {
  const editorState = getEditorState();
  const shouldAttach = Boolean(
    editorState.editor &&
    editorState.voltPath === session.voltPath &&
    editorState.filePath === session.filePath,
  );

  if (!shouldAttach) {
    detachSession(session);
    return;
  }

  attachSession(session, editorState.editor!);
}

function ensureSessionBridge(): void {
  if (bridgeUnsubscribe) {
    return;
  }

  bridgeUnsubscribe = subscribeToEditorState(() => {
    for (const session of sessions.values()) {
      if (!session.disposed) {
        syncSessionAttachment(session);
      }
    }
  });
}

function trackSessionOwnership(pluginId: string, sessionId: string): void {
  let ownedSessions = pluginSessions.get(pluginId);
  if (!ownedSessions) {
    ownedSessions = new Set();
    pluginSessions.set(pluginId, ownedSessions);
  }
  ownedSessions.add(sessionId);
}

function unregisterSession(session: InternalEditorSession): void {
  sessions.delete(session.id);
  const ownedSessions = pluginSessions.get(session.pluginId);
  ownedSessions?.delete(session.id);
  if (ownedSessions && ownedSessions.size === 0) {
    pluginSessions.delete(session.pluginId);
  }
}

function createSessionHandle(session: InternalEditorSession): PluginEditorSession {
  const assertActive = () => {
    if (session.disposed) {
      throw new Error(`Editor session "${session.id}" is already disposed`);
    }
  };

  return {
    id: session.id,
    filePath: session.filePath,
    getMarkdown() {
      assertActive();
      return session.markdown;
    },
    async save() {
      assertActive();
      if (session.pendingSaveTimer) {
        clearTimeout(session.pendingSaveTimer);
        session.pendingSaveTimer = null;
      }
      await queueSessionSave(session);
    },
    dispose() {
      if (session.disposed) {
        return;
      }

      session.disposed = true;
      if (session.pendingSaveTimer) {
        clearTimeout(session.pendingSaveTimer);
        session.pendingSaveTimer = null;
        void queueSessionSave(session);
      }
      detachSession(session);
      session.changeListeners.clear();
      session.anchors.clear();
      unregisterSession(session);
    },
    onDidChange(callback) {
      assertActive();
      session.changeListeners.add(callback);
      return () => {
        session.changeListeners.delete(callback);
      };
    },
    getSelection() {
      assertActive();
      return { ...session.selection };
    },
    createAnchor(options) {
      assertActive();
      const baseSelection = session.selection;
      const range = clampRange(
        session.markdown,
        options?.from ?? baseSelection.from,
        options?.to ?? baseSelection.to,
      );
      const anchorId = globalThis.crypto?.randomUUID?.() ?? `anchor-${Date.now()}-${session.anchors.size}`;
      session.anchors.set(anchorId, {
        id: anchorId,
        from: range.from,
        to: range.to,
        bias: options?.bias ?? 'end',
      });
      return anchorId;
    },
    getAnchorRange(anchorId) {
      assertActive();
      const anchor = session.anchors.get(anchorId);
      if (!anchor) {
        return null;
      }
      return { from: anchor.from, to: anchor.to };
    },
    insertAtAnchor(anchorId, text) {
      assertActive();
      const anchor = session.anchors.get(anchorId);
      if (!anchor) {
        throw new Error(`Anchor "${anchorId}" is not available`);
      }

      const insertPosition = anchor.bias === 'start' ? anchor.from : anchor.to;
      applyTextChange(session, insertPosition, insertPosition, text);
      const nextPosition = anchor.bias === 'start' ? insertPosition : insertPosition + text.length;
      anchor.from = nextPosition;
      anchor.to = nextPosition;
    },
    replaceRange(range, text) {
      assertActive();
      const normalized = clampRange(session.markdown, range.from, range.to);
      applyTextChange(session, normalized.from, normalized.to, text);
    },
    removeAnchor(anchorId) {
      assertActive();
      session.anchors.delete(anchorId);
    },
  };
}

export async function captureActiveEditorSession(
  pluginId: string,
  voltPath: string,
): Promise<PluginEditorSession | null> {
  const editorState = getEditorState();
  if (!editorState.filePath || editorState.voltPath !== voltPath) {
    return null;
  }

  return openEditorSession(pluginId, voltPath, editorState.filePath);
}

export async function openEditorSession(
  pluginId: string,
  voltPath: string,
  filePath: string,
): Promise<PluginEditorSession> {
  ensureSessionBridge();

  const normalizedPath = filePath.trim();
  if (!normalizedPath) {
    throw new Error('File path is required');
  }

  const editorState = getEditorState();
  const initialMarkdown = (
    editorState.editor &&
    editorState.voltPath === voltPath &&
    editorState.filePath === normalizedPath
  )
    ? getEditorMarkdown(editorState.editor)
    : await readFile(voltPath, normalizedPath);

  const sessionId = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${sessions.size}`;
  const session: InternalEditorSession = {
    id: sessionId,
    pluginId,
    voltPath,
    filePath: normalizedPath,
    markdown: initialMarkdown,
    selection: { from: initialMarkdown.length, to: initialMarkdown.length },
    anchors: new Map(),
    changeListeners: new Set(),
    attachedEditor: null,
    attachedUpdateHandler: null,
    suppressAttachedSync: false,
    pendingSaveTimer: null,
    saveChain: Promise.resolve(),
    disposed: false,
  };

  sessions.set(sessionId, session);
  trackSessionOwnership(pluginId, sessionId);
  syncSessionAttachment(session);
  return createSessionHandle(session);
}

export function getEditorSessionSourceInfo(
  sessionId: string,
): { voltPath: string; filePath: string } | null {
  const session = sessions.get(sessionId);
  if (!session || session.disposed) {
    return null;
  }

  return {
    voltPath: session.voltPath,
    filePath: session.filePath,
  };
}

export function cleanupPluginEditorSessions(pluginId: string): void {
  const ownedSessionIds = Array.from(pluginSessions.get(pluginId) ?? []);
  for (const sessionId of ownedSessionIds) {
    const session = sessions.get(sessionId);
    if (!session || session.disposed) {
      continue;
    }
    createSessionHandle(session).dispose();
  }
}

export function cleanupAllEditorSessions(): void {
  for (const session of Array.from(sessions.values())) {
    if (!session.disposed) {
      createSessionHandle(session).dispose();
    }
  }
}
