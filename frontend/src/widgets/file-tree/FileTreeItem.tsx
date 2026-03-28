import { useState } from 'react';
import type { FileEntry } from '@api/note/types';
import { getEntryDisplayName, isMarkdownName } from '@app/lib/fileTree';
import { useFileTreeStore } from '@app/stores/fileTreeStore';
import { useTabStore } from '@app/stores/tabStore';
import { Icon } from '@uikit/icon';
import { FileTreeInlineEditor } from './FileTreeInlineEditor';
import styles from './FileTree.module.scss';

const EMPTY_PATHS = [] as const;

interface FileTreeItemProps {
  voltId: string;
  voltPath: string;
  entry: FileEntry;
  depth: number;
}

export function FileTreeItem({
  voltId,
  voltPath,
  entry,
  depth,
}: FileTreeItemProps) {
  const expandedPaths = useFileTreeStore((state) => state.expandedPaths[voltId] ?? EMPTY_PATHS);
  const selectedPath = useFileTreeStore((state) => state.selectedPath[voltId] ?? null);
  const pendingCreate = useFileTreeStore((state) => state.pendingCreate[voltId] ?? null);
  const editingItem = useFileTreeStore((state) => state.editingItem[voltId] ?? null);
  const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded);
  const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
  const startCreate = useFileTreeStore((state) => state.startCreate);
  const startRename = useFileTreeStore((state) => state.startRename);
  const requestDelete = useFileTreeStore((state) => state.requestDelete);
  const updateEditingValue = useFileTreeStore((state) => state.updateEditingValue);
  const updatePendingCreateValue = useFileTreeStore((state) => state.updatePendingCreateValue);
  const commitInlineEdit = useFileTreeStore((state) => state.commitInlineEdit);
  const cancelInlineEdit = useFileTreeStore((state) => state.cancelInlineEdit);
  const openTab = useTabStore((state) => state.openTab);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const expanded = expandedPaths.includes(entry.path);
  const isSelected = selectedPath === entry.path;
  const isEditing = editingItem?.path === entry.path;
  const isPendingCreateParent = pendingCreate?.parentPath === entry.path;
  const displayName = getEntryDisplayName(entry.name, entry.isDir);
  const iconName = entry.isDir ? (expanded ? 'folderOpen' : 'folder') : (isMarkdownName(entry.name) ? 'fileText' : 'file');

  const handleClick = () => {
    setSelectedPath(voltId, entry.path);
    if (entry.isDir) {
      toggleExpanded(voltId, entry.path);
    } else {
      openTab(voltId, entry.path, displayName);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPath(voltId, entry.path);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleMenuAction = (action: () => void) => {
    action();
    closeContextMenu();
  };

  return (
    <div>
      {isEditing && editingItem ? (
        <FileTreeInlineEditor
          depth={depth}
          iconName={iconName}
          value={editingItem.value}
          placeholder={entry.isDir ? 'Folder name' : 'File name'}
          onChange={(value) => updateEditingValue(voltId, value)}
          onSubmit={async () => {
            await commitInlineEdit(voltId, voltPath);
          }}
          onCancel={() => cancelInlineEdit(voltId)}
        />
      ) : (
        <div
          className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <span className={styles.icon}>
            <Icon name={iconName} size={16} />
          </span>
          <span className={styles.name}>{displayName}</span>
        </div>
      )}

      {contextMenu && (
        <>
          <div className={styles.overlay} onClick={closeContextMenu} />
          <div
            className={styles.contextMenu}
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {entry.isDir && (
              <>
                <button
                  className={styles.menuItem}
                  onClick={() => handleMenuAction(() => startCreate(voltId, entry.path, false))}
                >
                  New File
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => handleMenuAction(() => startCreate(voltId, entry.path, true))}
                >
                  New Folder
                </button>
                <div className={styles.menuDivider} />
              </>
            )}
            <button
              className={styles.menuItem}
              onClick={() => handleMenuAction(() => startRename(voltId, entry.path))}
            >
              Rename
            </button>
            <button
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={() => handleMenuAction(() => requestDelete(voltId, entry.path))}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {entry.isDir && expanded && (
        <div>
          {isPendingCreateParent && pendingCreate ? (
            <FileTreeInlineEditor
              depth={depth + 1}
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

          {entry.children?.map((child) => (
            <FileTreeItem
              key={child.path}
              voltId={voltId}
              voltPath={voltPath}
              entry={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
