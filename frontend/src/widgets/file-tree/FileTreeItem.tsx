import { useState } from 'react';
import type { FileEntry } from '@api/note/types';
import {
  getDropParentPath,
  getDropPositionForPointer,
  getEntryDisplayName,
  isMarkdownName,
  validateMoveTarget,
} from '@app/lib/fileTree';
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
  const draggingPath = useFileTreeStore((state) => state.draggingPath[voltId] ?? null);
  const draggingIsDir = useFileTreeStore((state) => state.draggingIsDir[voltId] ?? null);
  const dropTargetPath = useFileTreeStore((state) => state.dropTargetPath[voltId] ?? null);
  const dropPosition = useFileTreeStore((state) => state.dropPosition[voltId] ?? null);
  const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded);
  const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
  const startCreate = useFileTreeStore((state) => state.startCreate);
  const startRename = useFileTreeStore((state) => state.startRename);
  const requestDelete = useFileTreeStore((state) => state.requestDelete);
  const updateEditingValue = useFileTreeStore((state) => state.updateEditingValue);
  const updatePendingCreateValue = useFileTreeStore((state) => state.updatePendingCreateValue);
  const commitInlineEdit = useFileTreeStore((state) => state.commitInlineEdit);
  const cancelInlineEdit = useFileTreeStore((state) => state.cancelInlineEdit);
  const startDrag = useFileTreeStore((state) => state.startDrag);
  const endDrag = useFileTreeStore((state) => state.endDrag);
  const updateDropTarget = useFileTreeStore((state) => state.updateDropTarget);
  const clearDropTarget = useFileTreeStore((state) => state.clearDropTarget);
  const commitMove = useFileTreeStore((state) => state.commitMove);
  const scheduleHoverExpand = useFileTreeStore((state) => state.scheduleHoverExpand);
  const cancelHoverExpand = useFileTreeStore((state) => state.cancelHoverExpand);
  const openTab = useTabStore((state) => state.openTab);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const expanded = expandedPaths.includes(entry.path);
  const isSelected = selectedPath === entry.path;
  const isEditing = editingItem?.path === entry.path;
  const isPendingCreateParent = pendingCreate?.parentPath === entry.path;
  const isDraggingItem = draggingPath === entry.path;
  const isDropInside = dropTargetPath === entry.path && dropPosition === 'inside';
  const isDropBefore = dropTargetPath === entry.path && dropPosition === 'before';
  const isDropAfter = dropTargetPath === entry.path && dropPosition === 'after';
  const displayName = getEntryDisplayName(entry.name, entry.isDir);
  const iconName = entry.isDir ? (expanded ? 'folderOpen' : 'folder') : (isMarkdownName(entry.name) ? 'fileText' : 'file');
  const isDragDisabled = Boolean(editingItem || pendingCreate);

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

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingPath || draggingIsDir == null || draggingPath === entry.path) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const position = getDropPositionForPointer(event.clientY - rect.top, rect.height, entry.isDir);
    const targetParentPath = getDropParentPath(entry, position);
    const validationError = validateMoveTarget(draggingPath, targetParentPath, draggingIsDir);

    if (validationError) {
      cancelHoverExpand(voltId, entry.path);
      if (dropTargetPath === entry.path) {
        clearDropTarget(voltId);
      }
      return;
    }

    updateDropTarget(voltId, entry.path, targetParentPath, position);

    if (entry.isDir && position === 'inside' && !expanded) {
      scheduleHoverExpand(voltId, entry.path);
      return;
    }

    cancelHoverExpand(voltId, entry.path);
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
          className={[
            styles.item,
            isSelected ? styles.itemSelected : '',
            isDraggingItem ? styles.itemDragging : '',
            isDropInside ? styles.itemDropInside : '',
            isDropBefore ? styles.itemDropBefore : '',
            isDropAfter ? styles.itemDropAfter : '',
          ].filter(Boolean).join(' ')}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          draggable={!isDragDisabled}
          onDragStart={(event) => {
            if (isDragDisabled) {
              event.preventDefault();
              return;
            }

            event.stopPropagation();
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', entry.path);
            startDrag(voltId, entry.path, entry.isDir);
          }}
          onDragOver={handleDragOver}
          onDrop={(event) => {
            if (!draggingPath) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            cancelHoverExpand(voltId, entry.path);
            void commitMove(voltId, voltPath);
          }}
          onDragLeave={(event) => {
            const relatedTarget = event.relatedTarget as Node | null;
            if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
              return;
            }

            cancelHoverExpand(voltId, entry.path);
            if (dropTargetPath === entry.path) {
              clearDropTarget(voltId);
            }
          }}
          onDragEnd={() => {
            cancelHoverExpand(voltId, entry.path);
            endDrag(voltId);
          }}
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
