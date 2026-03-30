import { useCallback, useEffect, useRef } from 'react';
import { useActiveFileStore } from '@entities/editor-session';
import { useTabStore } from '@entities/tab';
import { readFile, writeFile } from '@shared/api/file';
import { emit } from '@shared/lib/plugin-runtime';

interface UseFileSessionOptions {
  voltId: string;
  voltPath: string;
  filePath: string | null;
  /** Get current content for saving */
  getContent: () => string;
  /** Set content when file is loaded */
  setContent: (content: string) => void;
  /** Optional transform before save (e.g. unresolve image URLs) */
  transformBeforeSave?: (content: string) => string;
  /** Optional transform after load (e.g. resolve image URLs) */
  transformAfterLoad?: (content: string) => Promise<string> | string;
  /** Called when file path changes and there's no file */
  onClear?: () => void;
  /** Auto-save delay in ms (0 to disable) */
  autoSaveDelay?: number;
}

export function useFileSession({
  voltId,
  voltPath,
  filePath,
  getContent,
  setContent,
  transformBeforeSave,
  transformAfterLoad,
  onClear,
  autoSaveDelay = 500,
}: UseFileSessionOptions) {
  const loadedPathRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDirty = useTabStore((state) => state.setDirty);
  const pendingRename = useTabStore((state) => state.pendingRenames[voltId] ?? null);
  const consumePendingRename = useTabStore((state) => state.consumePendingRename);
  const registerSaveHandler = useActiveFileStore((state) => state.registerSaveHandler);
  const activeFileTab = useTabStore((state) => {
    if (!filePath) return null;
    const voltTabs = state.tabs[voltId] ?? [];
    return voltTabs.find((tab) => tab.id === filePath) ?? null;
  });

  const save = useCallback(async () => {
    if (!filePath) return;
    try {
      let content = getContent();
      if (transformBeforeSave) {
        content = transformBeforeSave(content);
      }
      await writeFile(voltPath, filePath, content);
      setDirty(voltId, filePath, false);
      emit('file-save', filePath);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [filePath, getContent, transformBeforeSave, setDirty, voltId, voltPath]);

  // Load file content
  useEffect(() => {
    if (!filePath) {
      loadedPathRef.current = null;
      onClear?.();
      return;
    }

    if (loadedPathRef.current === filePath) return;

    let cancelled = false;

    (async () => {
      try {
        const isRenameTransition = pendingRename?.newPath === filePath && loadedPathRef.current === pendingRename.oldPath;
        if (isRenameTransition) {
          if (activeFileTab?.isDirty) {
            await save();
          }
          loadedPathRef.current = filePath;
          consumePendingRename(voltId, filePath);
          return;
        }

        const raw = await readFile(voltPath, filePath);
        if (cancelled) return;
        const content = transformAfterLoad ? await transformAfterLoad(raw) : raw;
        if (cancelled) return;
        setContent(content);
        loadedPathRef.current = filePath;
        setDirty(voltId, filePath, false);
        emit('file-open', filePath);
      } catch (error) {
        console.error('Failed to load file:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [activeFileTab?.isDirty, consumePendingRename, filePath, onClear, pendingRename, save, setContent, setDirty, transformAfterLoad, voltId, voltPath]);

  // Register save handler
  useEffect(() => {
    if (!filePath) return;
    return registerSaveHandler(voltId, filePath, save);
  }, [filePath, registerSaveHandler, save, voltId]);

  // Cleanup timer
  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const markDirtyAndAutoSave = useCallback(() => {
    if (!filePath) return;
    setDirty(voltId, filePath, true);
    emit('editor-change', undefined);

    if (autoSaveDelay > 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        void save();
      }, autoSaveDelay);
    }
  }, [autoSaveDelay, filePath, save, setDirty, voltId]);

  return { save, markDirtyAndAutoSave };
}
