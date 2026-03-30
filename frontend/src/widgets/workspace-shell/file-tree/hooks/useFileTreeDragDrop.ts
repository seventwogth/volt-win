import { useCallback } from 'react';
import { useFileTreeStore } from '@entities/file-tree';
import {
  getDropParentPath,
  getDropPositionForPointer,
  validateMoveTarget,
} from '@shared/lib/fileTree';
import type { FileEntry } from '@shared/api/file/types';

export function useFileTreeDragDrop(voltId: string, voltPath: string) {
  const startDrag = useFileTreeStore((state) => state.startDrag);
  const endDrag = useFileTreeStore((state) => state.endDrag);
  const updateDropTarget = useFileTreeStore((state) => state.updateDropTarget);
  const clearDropTarget = useFileTreeStore((state) => state.clearDropTarget);
  const commitMove = useFileTreeStore((state) => state.commitMove);
  const scheduleHoverExpand = useFileTreeStore((state) => state.scheduleHoverExpand);
  const cancelHoverExpand = useFileTreeStore((state) => state.cancelHoverExpand);

  const handleDragStart = useCallback((
    event: React.DragEvent<HTMLDivElement>,
    entry: FileEntry,
    isDragDisabled: boolean,
  ) => {
    if (isDragDisabled) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.path);
    startDrag(voltId, entry.path, entry.isDir);
  }, [voltId, startDrag]);

  const handleDragOver = useCallback((
    event: React.DragEvent<HTMLDivElement>,
    entry: FileEntry,
    expanded: boolean,
    draggingPath: string | null,
    draggingIsDir: boolean | null,
    dropTargetPath: string | null,
  ) => {
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
  }, [voltId, updateDropTarget, clearDropTarget, scheduleHoverExpand, cancelHoverExpand]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>, draggingPath: string | null, entryPath: string) => {
    if (!draggingPath) return;
    event.preventDefault();
    event.stopPropagation();
    cancelHoverExpand(voltId, entryPath);
    void commitMove(voltId, voltPath);
  }, [voltId, voltPath, commitMove, cancelHoverExpand]);

  const handleDragLeave = useCallback((
    event: React.DragEvent<HTMLDivElement>,
    entryPath: string,
    dropTargetPath: string | null,
  ) => {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return;
    }
    cancelHoverExpand(voltId, entryPath);
    if (dropTargetPath === entryPath) {
      clearDropTarget(voltId);
    }
  }, [voltId, cancelHoverExpand, clearDropTarget]);

  const handleDragEnd = useCallback((entryPath: string) => {
    cancelHoverExpand(voltId, entryPath);
    endDrag(voltId);
  }, [voltId, cancelHoverExpand, endDrag]);

  return {
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragLeave,
    handleDragEnd,
  };
}
