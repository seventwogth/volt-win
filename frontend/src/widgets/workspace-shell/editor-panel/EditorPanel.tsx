import { useEffect, useRef } from 'react';
import { EditorContent } from '@tiptap/react';
import { useAppSettingsStore } from '@entities/app-settings';
import { useActiveFileStore } from '@entities/editor-session';
import { useFileTreeStore } from '@entities/file-tree';
import { useTabStore } from '@entities/tab';
import { readFile } from '@shared/api/file';
import { useI18n } from '@app/providers/I18nProvider';
import { emit, setEditor } from '@shared/lib/plugin-runtime';
import { useEditorSetup } from './hooks/useEditorSetup';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageResolver } from './hooks/useImageResolver';
import { useImageHandlers } from './hooks/useImageHandlers';
import { TableBubbleMenu } from './extensions/TableBubbleMenu';
import { PluginTaskStatusBanner } from '@features/plugin-task-status';
import styles from './EditorPanel.module.scss';

interface EditorPanelProps {
  voltId: string;
  voltPath: string;
  filePath: string | null;
}

export function EditorPanel({ voltId, voltPath, filePath }: EditorPanelProps) {
  const { t } = useI18n();
  const imageDir = useAppSettingsStore((state) => state.settings.imageDir);
  const editor = useEditorSetup({ placeholder: t('editor.placeholder') });
  const loadedPathRef = useRef<string | null>(null);
  const { resolve, register, unresolveAll, resolveAll, clear } = useImageResolver(voltPath);
  const notifyFsMutation = useFileTreeStore((state) => state.notifyFsMutation);
  const registerSaveHandler = useActiveFileStore((state) => state.registerSaveHandler);
  const pendingRename = useTabStore((state) => state.pendingRenames[voltId] ?? null);
  const consumePendingRename = useTabStore((state) => state.consumePendingRename);
  const activeFileTab = useTabStore((state) => {
    if (!filePath) return null;
    const voltTabs = state.tabs[voltId] ?? [];
    return voltTabs.find((tab) => tab.id === filePath) ?? null;
  });

  const { save } = useAutoSave({ editor, voltId, voltPath, filePath, transformMarkdown: unresolveAll });
  const { handleDrop, handleDragOver, handlePaste } = useImageHandlers({
    editor, voltId, voltPath, imageDir, resolve, register, notifyFsMutation,
  });

  // Register editor with plugin bridge
  useEffect(() => {
    if (editor) {
      setEditor(editor, { voltId, voltPath, filePath });
    } else {
      setEditor(null);
    }
    return () => { setEditor(null); };
  }, [editor, filePath, voltId, voltPath]);

  useEffect(() => {
    if (filePath) return;
    loadedPathRef.current = null;
    clear();
  }, [clear, filePath]);

  // Load file content
  useEffect(() => {
    if (!editor || !filePath) return;
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

        clear();
        const raw = await readFile(voltPath, filePath);
        if (cancelled) return;
        const content = await resolveAll(raw);
        if (cancelled) return;
        editor.commands.setContent(content);
        loadedPathRef.current = filePath;
        emit('file-open', filePath);
      } catch (e) {
        console.error('Failed to load note:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [activeFileTab?.isDirty, clear, consumePendingRename, editor, filePath, pendingRename, resolveAll, save, voltId, voltPath]);

  useEffect(() => {
    if (!filePath) return;
    return registerSaveHandler(voltId, filePath, save);
  }, [filePath, registerSaveHandler, save, voltId]);

  if (!filePath) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyText}>{t('editor.empty')}</span>
      </div>
    );
  }

  return (
    <div
      className={styles.panel}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onPaste={handlePaste}
    >
      <PluginTaskStatusBanner voltPath={voltPath} filePath={filePath} />
      <div className={styles.editorContent}>
        {editor && <TableBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
