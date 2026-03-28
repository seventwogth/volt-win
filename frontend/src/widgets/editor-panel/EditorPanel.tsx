import { useCallback, useEffect, useRef } from 'react';
import { EditorContent } from '@tiptap/react';
import { readNote } from '@api/note/noteApi';
import { copyImage, pickImage, saveImageBase64, base64ToBlobUrl } from '@api/image/imageApi';
import { useFileTreeStore } from '@app/stores/fileTreeStore';
import { useTabStore } from '@app/stores/tabStore';
import { useEditorSetup } from './hooks/useEditorSetup';
import { useAutoSave } from './hooks/useAutoSave';
import { useImageResolver } from './hooks/useImageResolver';
import { TableBubbleMenu } from './extensions/TableBubbleMenu';
import styles from './EditorPanel.module.scss';

const IMAGE_DIR_KEY = 'volt-image-dir';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

function getImageDir(): string {
  return localStorage.getItem(IMAGE_DIR_KEY) || 'attachments';
}

interface EditorPanelProps {
  voltId: string;
  voltPath: string;
  filePath: string | null;
}

export function EditorPanel({ voltId, voltPath, filePath }: EditorPanelProps) {
  const editor = useEditorSetup();
  const loadedPathRef = useRef<string | null>(null);
  const { resolve, register, unresolveAll, resolveAll, clear } = useImageResolver(voltPath);
  const notifyFsMutation = useFileTreeStore((state) => state.notifyFsMutation);
  const pendingRename = useTabStore((state) => state.pendingRenames[voltId] ?? null);
  const consumePendingRename = useTabStore((state) => state.consumePendingRename);
  const activeFileTab = useTabStore((state) => {
    if (!filePath) {
      return null;
    }

    const voltTabs = state.tabs[voltId] ?? [];
    return voltTabs.find((tab) => tab.id === filePath) ?? null;
  });

  const { save } = useAutoSave({ editor, voltId, voltPath, filePath, transformMarkdown: unresolveAll });

  useEffect(() => {
    if (filePath) {
      return;
    }

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
        const raw = await readNote(voltPath, filePath);
        if (cancelled) return;
        const content = await resolveAll(raw);
        if (cancelled) return;
        editor.commands.setContent(content);
        loadedPathRef.current = filePath;
      } catch (e) {
        console.error('Failed to load note:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [activeFileTab?.isDirty, clear, consumePendingRename, editor, filePath, pendingRename, resolveAll, save, voltId, voltPath]);

  useEffect(() => {
    if (!editor || !filePath) {
      return;
    }

    const handleSaveEvent = () => {
      void save();
    };

    window.addEventListener('volt:save-active-file', handleSaveEvent);
    return () => window.removeEventListener('volt:save-active-file', handleSaveEvent);
  }, [editor, filePath, save]);

  // Insert image with blob URL
  const insertImage = useCallback(async (relPath: string, existingBlobUrl?: string) => {
    if (!editor) return;
    let src: string;
    if (existingBlobUrl) {
      register(relPath, existingBlobUrl);
      src = existingBlobUrl;
    } else {
      src = await resolve(relPath);
    }
    editor.chain().focus().setImage({ src }).run();
  }, [editor, resolve, register]);

  // Handle image drag-and-drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (IMAGE_TYPES.includes(file.type)) {
        e.preventDefault();
        e.stopPropagation();

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const result = reader.result as string;
            const b64 = result.split(',')[1];
            if (!b64) return;
            const relPath = await saveImageBase64(voltPath, file.name, getImageDir(), b64);
            const blobUrl = base64ToBlobUrl(b64, file.type);
            await insertImage(relPath, blobUrl);
            void notifyFsMutation(voltId, voltPath);
          } catch (err) {
            console.error('Failed to save dropped image:', err);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [insertImage, notifyFsMutation, voltId, voltPath]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Handle clipboard paste with images
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const result = reader.result as string;
            const b64 = result.split(',')[1];
            if (!b64) return;
            const ext = blob.type.split('/')[1] || 'png';
            const fileName = `pasted_${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
            const relPath = await saveImageBase64(voltPath, fileName, getImageDir(), b64);
            const blobUrl = base64ToBlobUrl(b64, blob.type);
            await insertImage(relPath, blobUrl);
            void notifyFsMutation(voltId, voltPath);
          } catch (err) {
            console.error('Failed to save pasted image:', err);
          }
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }, [insertImage, notifyFsMutation, voltId, voltPath]);

  // Listen for slash command image picker event
  useEffect(() => {
    if (!editor) return;

    const handler = async () => {
      try {
        const selectedPath = await pickImage();
        if (selectedPath) {
          const relPath = await copyImage(voltPath, selectedPath, getImageDir());
          await insertImage(relPath);
          void notifyFsMutation(voltId, voltPath);
        }
      } catch (e) {
        console.error('Failed to pick image:', e);
      }
    };

    window.addEventListener('volt:pick-image', handler);
    return () => window.removeEventListener('volt:pick-image', handler);
  }, [editor, insertImage, notifyFsMutation, voltId, voltPath]);

  if (!filePath) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyText}>Select a file to start editing</span>
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
      <div className={styles.editorContent}>
        {editor && <TableBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
