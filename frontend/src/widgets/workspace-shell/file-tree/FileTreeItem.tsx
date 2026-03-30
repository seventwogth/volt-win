import { memo, useState } from 'react';
import type { FileEntry } from '@shared/api/file/types';
import { getEntryDisplayName, isMarkdownName } from '@shared/lib/fileTree';
import { useI18n } from '@app/providers/I18nProvider';
import { Icon } from '@shared/ui/icon';
import { ContextMenu } from '@shared/ui/context-menu';
import type { ContextMenuItem } from '@shared/ui/context-menu';
import { FileTreeInlineEditor } from './FileTreeInlineEditor';
import { useFileTreeItemState } from './hooks/useFileTreeItemState';
import { useFileTreeItemActions } from './hooks/useFileTreeItemActions';
import { useFileTreeDragDrop } from './hooks/useFileTreeDragDrop';
import styles from './FileTree.module.scss';

interface FileTreeItemProps {
  voltId: string;
  voltPath: string;
  entry: FileEntry;
  depth: number;
}

export const FileTreeItem = memo(function FileTreeItem({ voltId, voltPath, entry, depth }: FileTreeItemProps) {
  const { t } = useI18n();
  const state = useFileTreeItemState(voltId, entry.path, entry.isDir);
  const actions = useFileTreeItemActions();
  const dragDrop = useFileTreeDragDrop(voltId, voltPath);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const displayName = getEntryDisplayName(entry.name, entry.isDir);
  const iconName = entry.isDir ? (state.expanded ? 'folderOpen' : 'folder') : (isMarkdownName(entry.name) ? 'fileText' : 'file');

  const handleClick = () => {
    actions.setSelectedPath(voltId, entry.path);
    if (entry.isDir) {
      actions.toggleExpanded(voltId, entry.path);
    } else {
      state.openTab(voltId, entry.path, displayName);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    actions.setSelectedPath(voltId, entry.path);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextMenuItems: ContextMenuItem[] = [
    ...(entry.isDir ? [
      { label: t('fileTree.context.newFile'), onClick: () => actions.startCreate(voltId, entry.path, false) },
      { label: t('fileTree.context.newFolder'), onClick: () => actions.startCreate(voltId, entry.path, true) },
      { label: '', onClick: () => {}, separator: true },
    ] : []),
    { label: t('fileTree.context.rename'), onClick: () => actions.startRename(voltId, entry.path) },
    { label: t('fileTree.context.delete'), onClick: () => actions.requestDelete(voltId, entry.path), danger: true },
    ...(state.pluginMenuItems.length > 0 ? [
      { label: '', onClick: () => {}, separator: true },
      ...state.pluginMenuItems.map((item) => ({
        label: item.label,
        onClick: () => item.callback({ path: entry.path, isDir: entry.isDir }),
      })),
    ] : []),
  ];

  return (
    <div>
      {state.isEditing && state.editingItem ? (
        <FileTreeInlineEditor
          depth={depth}
          iconName={iconName}
          value={state.editingItem.value}
          placeholder={entry.isDir ? t('fileTree.placeholder.folder') : t('fileTree.placeholder.file')}
          onChange={(value) => actions.updateEditingValue(voltId, value)}
          onSubmit={async () => { await actions.commitInlineEdit(voltId, voltPath); }}
          onCancel={() => actions.cancelInlineEdit(voltId)}
        />
      ) : (
        <div
          className={[
            styles.item,
            state.isSelected ? styles.itemSelected : '',
            state.isDraggingItem ? styles.itemDragging : '',
            state.isDropInside ? styles.itemDropInside : '',
            state.isDropBefore ? styles.itemDropBefore : '',
            state.isDropAfter ? styles.itemDropAfter : '',
          ].filter(Boolean).join(' ')}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          draggable={!state.isDragDisabled}
          onDragStart={(e) => dragDrop.handleDragStart(e, entry, state.isDragDisabled)}
          onDragOver={(e) => dragDrop.handleDragOver(e, entry, state.expanded, state.draggingPath, state.draggingIsDir, state.dropTargetPath)}
          onDrop={(e) => dragDrop.handleDrop(e, state.draggingPath, entry.path)}
          onDragLeave={(e) => dragDrop.handleDragLeave(e, entry.path, state.dropTargetPath)}
          onDragEnd={() => dragDrop.handleDragEnd(entry.path)}
        >
          <span className={styles.icon}>
            <Icon name={iconName} size={16} />
          </span>
          <span className={styles.name}>{displayName}</span>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {entry.isDir && state.expanded && (
        <div>
          {state.isPendingCreateParent && state.pendingCreate ? (
            <FileTreeInlineEditor
              depth={depth + 1}
              iconName={state.pendingCreate.isDir ? 'folder' : 'fileText'}
              value={state.pendingCreate.value}
              placeholder={state.pendingCreate.isDir ? t('fileTree.placeholder.folder') : t('fileTree.placeholder.note')}
              onChange={(value) => actions.updatePendingCreateValue(voltId, value)}
              onSubmit={async () => { await actions.commitInlineEdit(voltId, voltPath); }}
              onCancel={() => actions.cancelInlineEdit(voltId)}
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
});
