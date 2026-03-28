import { useEffect } from 'react';
import { findEntryByPath } from '@app/lib/fileTree';
import { useFileTreeStore } from '@app/stores/fileTreeStore';
import { Button } from '@uikit/button';
import { Modal } from '@uikit/modal';
import { FileTreeInlineEditor } from './FileTreeInlineEditor';
import { FileTreeItem } from './FileTreeItem';
import styles from './FileTree.module.scss';

const EMPTY_TREE = [] as const;

interface FileTreeProps {
  voltId: string;
  voltPath: string;
}

export function FileTree({ voltId, voltPath }: FileTreeProps) {
  const tree = useFileTreeStore((state) => state.trees[voltId] ?? EMPTY_TREE);
  const loading = useFileTreeStore((state) => state.loading[voltId] ?? false);
  const error = useFileTreeStore((state) => state.error[voltId] ?? null);
  const pendingCreate = useFileTreeStore((state) => state.pendingCreate[voltId] ?? null);
  const pendingDelete = useFileTreeStore((state) => state.pendingDelete[voltId] ?? null);
  const selectedPath = useFileTreeStore((state) => state.selectedPath[voltId] ?? null);
  const loadTree = useFileTreeStore((state) => state.loadTree);
  const notifyFsMutation = useFileTreeStore((state) => state.notifyFsMutation);
  const startRename = useFileTreeStore((state) => state.startRename);
  const updatePendingCreateValue = useFileTreeStore((state) => state.updatePendingCreateValue);
  const commitInlineEdit = useFileTreeStore((state) => state.commitInlineEdit);
  const cancelInlineEdit = useFileTreeStore((state) => state.cancelInlineEdit);
  const cancelDelete = useFileTreeStore((state) => state.cancelDelete);
  const confirmDelete = useFileTreeStore((state) => state.confirmDelete);

  useEffect(() => {
    void loadTree(voltId, voltPath).catch(() => undefined);
  }, [loadTree, voltId, voltPath]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F2') {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (!selectedPath || pendingCreate) {
        return;
      }

      const entry = findEntryByPath(tree, selectedPath);
      if (!entry) {
        return;
      }

      event.preventDefault();
      startRename(voltId, selectedPath);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCreate, selectedPath, startRename, tree, voltId]);

  const showRootCreate = pendingCreate?.parentPath === '';

  return (
    <>
      <div className={styles.tree}>
        {loading && tree.length === 0 && !showRootCreate ? (
          <div className={styles.empty}>Loading...</div>
        ) : null}

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : null}

        {!error && tree.length === 0 && !showRootCreate && !loading ? (
          <div className={styles.empty}>No files yet</div>
        ) : null}

        {(tree.length > 0 || showRootCreate) && !error ? (
          <div className={styles.list}>
            {showRootCreate && pendingCreate ? (
              <FileTreeInlineEditor
                depth={0}
                iconName={pendingCreate.isDir ? 'folder' : 'fileText'}
                value={pendingCreate.value}
                placeholder={pendingCreate.isDir ? 'Folder name' : 'Note name'}
                onChange={(value) => updatePendingCreateValue(voltId, value)}
                onSubmit={async () => {
                  await commitInlineEdit(voltId, voltPath);
                }}
                onCancel={() => cancelInlineEdit(voltId)}
              />
            ) : null}

            {tree.map((entry) => (
              <FileTreeItem
                key={entry.path}
                voltId={voltId}
                voltPath={voltPath}
                entry={entry}
                depth={0}
              />
            ))}
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => cancelDelete(voltId)}
        title={pendingDelete?.isDir ? 'Delete folder' : 'Delete file'}
      >
        <p className={styles.deleteMessage}>
          Delete "{pendingDelete?.name}"? This action cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <Button variant="ghost" size="md" onClick={() => cancelDelete(voltId)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              void confirmDelete(voltId, voltPath);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
