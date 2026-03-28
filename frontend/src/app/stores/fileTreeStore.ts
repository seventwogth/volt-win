import { create } from 'zustand';
import type { FileEntry } from '@api/note/types';
import {
  createDirectory,
  createNote,
  deleteNote,
  listTree,
  renameNote,
} from '@api/note/noteApi';
import {
  type FileTreeDropPosition,
  buildRenamedPath,
  buildRenamedFilePath,
  buildMovedPath,
  ensureMarkdownFileName,
  findEntryByPath,
  getEntryDisplayName,
  getParentPath,
  getPathBasename,
  hasPathPrefix,
  isMarkdownName,
  isFolderMoveIntoOwnSubtree,
  joinRelativePath,
  removePathPrefixFromList,
  replacePathPrefix,
  replacePathPrefixInList,
  validateMoveTarget,
  validateInlineName,
} from '@app/lib/fileTree';
import { useToastStore } from './toastStore';
import { useTabStore } from './tabStore';

const HOVER_EXPAND_DELAY_MS = 400;
const hoverExpandTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface InlineRenameState {
  path: string;
  value: string;
  isDir: boolean;
  isMarkdown: boolean;
}

interface PendingCreateState {
  parentPath: string;
  isDir: boolean;
  value: string;
}

interface DeleteTargetState {
  path: string;
  name: string;
  isDir: boolean;
}

interface FileTreeState {
  trees: Record<string, FileEntry[]>;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  expandedPaths: Record<string, string[]>;
  editingItem: Record<string, InlineRenameState | null>;
  pendingCreate: Record<string, PendingCreateState | null>;
  selectedPath: Record<string, string | null>;
  pendingDelete: Record<string, DeleteTargetState | null>;
  draggingPath: Record<string, string | null>;
  draggingIsDir: Record<string, boolean | null>;
  dropTargetPath: Record<string, string | null>;
  dropTargetParentPath: Record<string, string | null>;
  dropPosition: Record<string, FileTreeDropPosition | null>;
  hoverExpandPath: Record<string, string | null>;
  loadTree: (voltId: string, voltPath: string) => Promise<void>;
  refreshTree: (voltId: string, voltPath: string) => Promise<void>;
  notifyFsMutation: (voltId: string, voltPath: string) => Promise<void>;
  toggleExpanded: (voltId: string, path: string) => void;
  setSelectedPath: (voltId: string, path: string | null) => void;
  startCreate: (voltId: string, parentPath: string, isDir: boolean) => void;
  updatePendingCreateValue: (voltId: string, value: string) => void;
  startRename: (voltId: string, path: string) => void;
  updateEditingValue: (voltId: string, value: string) => void;
  commitInlineEdit: (voltId: string, voltPath: string) => Promise<string | null>;
  cancelInlineEdit: (voltId: string) => void;
  requestDelete: (voltId: string, path: string) => void;
  cancelDelete: (voltId: string) => void;
  confirmDelete: (voltId: string, voltPath: string) => Promise<void>;
  startDrag: (voltId: string, path: string, isDir: boolean) => void;
  endDrag: (voltId: string) => void;
  updateDropTarget: (
    voltId: string,
    targetPath: string | null,
    targetParentPath: string,
    position: FileTreeDropPosition,
  ) => void;
  clearDropTarget: (voltId: string) => void;
  commitMove: (voltId: string, voltPath: string) => Promise<string | null>;
  scheduleHoverExpand: (voltId: string, path: string) => void;
  cancelHoverExpand: (voltId: string, path?: string) => void;
}

type FileTreeSetState = (
  partial:
    | Partial<FileTreeState>
    | ((state: FileTreeState) => Partial<FileTreeState>)
) => void;

function getExpandedPaths(state: FileTreeState, voltId: string): string[] {
  return state.expandedPaths[voltId] ?? [];
}

function setExpanded(paths: string[], targetPath: string): string[] {
  if (!targetPath) {
    return paths;
  }

  if (paths.includes(targetPath)) {
    return paths;
  }

  return [...paths, targetPath];
}

function clearMutationState(state: FileTreeState, voltId: string) {
  return {
    editingItem: { ...state.editingItem, [voltId]: null },
    pendingCreate: { ...state.pendingCreate, [voltId]: null },
  };
}

function clearHoverExpandTimer(voltId: string) {
  const timer = hoverExpandTimers.get(voltId);
  if (timer) {
    clearTimeout(timer);
    hoverExpandTimers.delete(voltId);
  }
}

function clearDragState(state: FileTreeState, voltId: string) {
  return {
    draggingPath: { ...state.draggingPath, [voltId]: null },
    draggingIsDir: { ...state.draggingIsDir, [voltId]: null },
    dropTargetPath: { ...state.dropTargetPath, [voltId]: null },
    dropTargetParentPath: { ...state.dropTargetParentPath, [voltId]: null },
    dropPosition: { ...state.dropPosition, [voltId]: null },
    hoverExpandPath: { ...state.hoverExpandPath, [voltId]: null },
  };
}

function showError(message: string) {
  useToastStore.getState().addToast(message, 'error');
}

function showSuccess(message: string) {
  useToastStore.getState().addToast(message, 'success');
}

async function loadTreeData(set: FileTreeSetState, voltId: string, voltPath: string) {
  set((state) => ({
    loading: { ...state.loading, [voltId]: true },
    error: { ...state.error, [voltId]: null },
  }));

  try {
    const tree = await listTree(voltPath);
    set((state) => ({
      trees: { ...state.trees, [voltId]: tree },
      loading: { ...state.loading, [voltId]: false },
      error: { ...state.error, [voltId]: null },
    }));
  } catch (err) {
    set((state) => ({
      loading: { ...state.loading, [voltId]: false },
      error: {
        ...state.error,
        [voltId]: (err as Error).message,
      },
    }));
    throw err;
  }
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  trees: {},
  loading: {},
  error: {},
  expandedPaths: {},
  editingItem: {},
  pendingCreate: {},
  selectedPath: {},
  pendingDelete: {},
  draggingPath: {},
  draggingIsDir: {},
  dropTargetPath: {},
  dropTargetParentPath: {},
  dropPosition: {},
  hoverExpandPath: {},

  loadTree: async (voltId, voltPath) => {
    await loadTreeData(set, voltId, voltPath);
  },

  refreshTree: async (voltId, voltPath) => {
    await loadTreeData(set, voltId, voltPath);
  },

  notifyFsMutation: async (voltId, voltPath) => {
    try {
      await get().refreshTree(voltId, voltPath);
    } catch (err) {
      showError((err as Error).message);
    }
  },

  toggleExpanded: (voltId, path) => {
    const expanded = getExpandedPaths(get(), voltId);
    const nextExpanded = expanded.includes(path)
      ? expanded.filter((entryPath) => entryPath !== path)
      : [...expanded, path];

    set({
      expandedPaths: {
        ...get().expandedPaths,
        [voltId]: nextExpanded,
      },
    });
  },

  setSelectedPath: (voltId, path) => {
    set({
      selectedPath: {
        ...get().selectedPath,
        [voltId]: path,
      },
    });
  },

  startCreate: (voltId, parentPath, isDir) => {
    const expanded = parentPath ? setExpanded(getExpandedPaths(get(), voltId), parentPath) : getExpandedPaths(get(), voltId);
    set((state) => ({
      pendingCreate: {
        ...state.pendingCreate,
        [voltId]: {
          parentPath,
          isDir,
          value: '',
        },
      },
      editingItem: {
        ...state.editingItem,
        [voltId]: null,
      },
      expandedPaths: {
        ...state.expandedPaths,
        [voltId]: expanded,
      },
      selectedPath: {
        ...state.selectedPath,
        [voltId]: parentPath || null,
      },
      ...clearDragState(state, voltId),
    }));
    clearHoverExpandTimer(voltId);
  },

  updatePendingCreateValue: (voltId, value) => {
    const current = get().pendingCreate[voltId];
    if (!current) {
      return;
    }

    set({
      pendingCreate: {
        ...get().pendingCreate,
        [voltId]: { ...current, value },
      },
    });
  },

  startRename: (voltId, path) => {
    const tree = get().trees[voltId] ?? [];
    const entry = findEntryByPath(tree, path);
    if (!entry) {
      return;
    }

    set((state) => ({
      editingItem: {
        ...state.editingItem,
        [voltId]: {
          path,
          isDir: entry.isDir,
          value: getEntryDisplayName(entry.name, entry.isDir),
          isMarkdown: !entry.isDir && isMarkdownName(entry.name),
        },
      },
      pendingCreate: {
        ...state.pendingCreate,
        [voltId]: null,
      },
      selectedPath: {
        ...state.selectedPath,
        [voltId]: path,
      },
      ...clearDragState(state, voltId),
    }));
    clearHoverExpandTimer(voltId);
  },

  updateEditingValue: (voltId, value) => {
    const current = get().editingItem[voltId];
    if (!current) {
      return;
    }

    set({
      editingItem: {
        ...get().editingItem,
        [voltId]: { ...current, value },
      },
    });
  },

  commitInlineEdit: async (voltId, voltPath) => {
    const pendingCreate = get().pendingCreate[voltId];
    const editingItem = get().editingItem[voltId];

    if (!pendingCreate && !editingItem) {
      return null;
    }

    if (pendingCreate) {
      const trimmedValue = pendingCreate.value.trim();
      const validationError = validateInlineName(trimmedValue);
      if (validationError) {
        showError(validationError);
        return null;
      }

      const normalizedName = pendingCreate.isDir
        ? trimmedValue
        : ensureMarkdownFileName(trimmedValue);
      const nextPath = joinRelativePath(pendingCreate.parentPath, normalizedName);

      try {
        if (pendingCreate.isDir) {
          await createDirectory(voltPath, nextPath);
          showSuccess(`Folder "${normalizedName}" created`);
        } else {
          await createNote(voltPath, nextPath);
          useTabStore.getState().openTab(voltId, nextPath, getEntryDisplayName(normalizedName, false));
          showSuccess(`File "${getEntryDisplayName(normalizedName, false)}" created`);
        }

        set((state) => ({
          ...clearMutationState(state, voltId),
          selectedPath: {
            ...state.selectedPath,
            [voltId]: nextPath,
          },
          expandedPaths: {
            ...state.expandedPaths,
            [voltId]: pendingCreate.parentPath
              ? setExpanded(getExpandedPaths(state, voltId), pendingCreate.parentPath)
              : getExpandedPaths(state, voltId),
          },
        }));

        await get().refreshTree(voltId, voltPath);
        return nextPath;
      } catch (err) {
        showError((err as Error).message);
        return null;
      }
    }

    if (!editingItem) {
      return null;
    }

    const trimmedValue = editingItem.value.trim();
    const validationError = validateInlineName(trimmedValue);
    if (validationError) {
      showError(validationError);
      return null;
    }

    const nextPath = editingItem.isDir
      ? buildRenamedPath(editingItem.path, trimmedValue, true)
      : buildRenamedFilePath(editingItem.path, trimmedValue, editingItem.isMarkdown);
    if (nextPath === editingItem.path) {
      get().cancelInlineEdit(voltId);
      return editingItem.path;
    }

    try {
      await renameNote(voltPath, editingItem.path, nextPath);

      if (editingItem.isDir) {
        useTabStore.getState().replacePathPrefix(voltId, editingItem.path, nextPath);
      } else {
        useTabStore.getState().renamePath(voltId, editingItem.path, nextPath);
      }

      set((state) => ({
        ...clearMutationState(state, voltId),
        selectedPath: {
          ...state.selectedPath,
          [voltId]: replacePathPrefix(state.selectedPath[voltId] ?? '', editingItem.path, nextPath) || nextPath,
        },
        expandedPaths: {
          ...state.expandedPaths,
          [voltId]: editingItem.isDir
            ? replacePathPrefixInList(getExpandedPaths(state, voltId), editingItem.path, nextPath)
            : getExpandedPaths(state, voltId),
        },
      }));

      showSuccess(`Renamed to "${getEntryDisplayName(getPathBasename(nextPath), editingItem.isDir)}"`);
      await get().refreshTree(voltId, voltPath);
      return nextPath;
    } catch (err) {
      showError((err as Error).message);
      return null;
    }
  },

  cancelInlineEdit: (voltId) => {
    set((state) => ({
      ...clearMutationState(state, voltId),
    }));
  },

  requestDelete: (voltId, path) => {
    const tree = get().trees[voltId] ?? [];
    const entry = findEntryByPath(tree, path);
    if (!entry) {
      return;
    }

    set((state) => ({
      pendingDelete: {
        ...state.pendingDelete,
        [voltId]: {
          path,
          name: getEntryDisplayName(entry.name, entry.isDir),
          isDir: entry.isDir,
        },
      },
      ...clearMutationState(state, voltId),
      ...clearDragState(state, voltId),
      selectedPath: {
        ...state.selectedPath,
        [voltId]: path,
      },
    }));
    clearHoverExpandTimer(voltId);
  },

  cancelDelete: (voltId) => {
    set({
      pendingDelete: {
        ...get().pendingDelete,
        [voltId]: null,
      },
    });
  },

  confirmDelete: async (voltId, voltPath) => {
    const target = get().pendingDelete[voltId];
    if (!target) {
      return;
    }

    try {
      await deleteNote(voltPath, target.path);
      if (target.isDir) {
        useTabStore.getState().removePathPrefix(voltId, target.path);
      } else {
        useTabStore.getState().removePath(voltId, target.path);
      }

      set((state) => ({
        pendingDelete: {
          ...state.pendingDelete,
          [voltId]: null,
        },
        selectedPath: {
          ...state.selectedPath,
          [voltId]: state.selectedPath[voltId] && hasPathPrefix(state.selectedPath[voltId] ?? '', target.path)
            ? getParentPath(target.path) || null
            : state.selectedPath[voltId] ?? null,
        },
        expandedPaths: {
          ...state.expandedPaths,
          [voltId]: removePathPrefixFromList(getExpandedPaths(state, voltId), target.path),
        },
      }));

      showSuccess(`${target.isDir ? 'Folder' : 'File'} "${target.name}" deleted`);
      await get().refreshTree(voltId, voltPath);
    } catch (err) {
      showError((err as Error).message);
    }
  },

  startDrag: (voltId, path, isDir) => {
    clearHoverExpandTimer(voltId);
    set((state) => ({
      ...clearMutationState(state, voltId),
      pendingDelete: {
        ...state.pendingDelete,
        [voltId]: null,
      },
      draggingPath: {
        ...state.draggingPath,
        [voltId]: path,
      },
      draggingIsDir: {
        ...state.draggingIsDir,
        [voltId]: isDir,
      },
      dropTargetPath: {
        ...state.dropTargetPath,
        [voltId]: null,
      },
      dropTargetParentPath: {
        ...state.dropTargetParentPath,
        [voltId]: null,
      },
      dropPosition: {
        ...state.dropPosition,
        [voltId]: null,
      },
      hoverExpandPath: {
        ...state.hoverExpandPath,
        [voltId]: null,
      },
      selectedPath: {
        ...state.selectedPath,
        [voltId]: path,
      },
    }));
  },

  endDrag: (voltId) => {
    clearHoverExpandTimer(voltId);
    set((state) => ({
      ...clearDragState(state, voltId),
    }));
  },

  updateDropTarget: (voltId, targetPath, targetParentPath, position) => {
    const currentTargetPath = get().dropTargetPath[voltId] ?? null;
    const currentTargetParentPath = get().dropTargetParentPath[voltId] ?? null;
    const currentPosition = get().dropPosition[voltId] ?? null;

    if (
      currentTargetPath === targetPath &&
      currentTargetParentPath === targetParentPath &&
      currentPosition === position
    ) {
      return;
    }

    set((state) => ({
      dropTargetPath: {
        ...state.dropTargetPath,
        [voltId]: targetPath,
      },
      dropTargetParentPath: {
        ...state.dropTargetParentPath,
        [voltId]: targetParentPath,
      },
      dropPosition: {
        ...state.dropPosition,
        [voltId]: position,
      },
    }));
  },

  clearDropTarget: (voltId) => {
    const hasDropTarget = (
      get().dropTargetPath[voltId] != null ||
      get().dropTargetParentPath[voltId] != null ||
      get().dropPosition[voltId] != null ||
      get().hoverExpandPath[voltId] != null
    );

    if (!hasDropTarget) {
      return;
    }

    clearHoverExpandTimer(voltId);
    set((state) => ({
      dropTargetPath: {
        ...state.dropTargetPath,
        [voltId]: null,
      },
      dropTargetParentPath: {
        ...state.dropTargetParentPath,
        [voltId]: null,
      },
      dropPosition: {
        ...state.dropPosition,
        [voltId]: null,
      },
      hoverExpandPath: {
        ...state.hoverExpandPath,
        [voltId]: null,
      },
    }));
  },

  commitMove: async (voltId, voltPath) => {
    const draggingPath = get().draggingPath[voltId];
    const draggingIsDir = get().draggingIsDir[voltId];
    const dropTargetParentPath = get().dropTargetParentPath[voltId];

    if (!draggingPath || draggingIsDir == null || dropTargetParentPath == null) {
      return null;
    }

    const validationError = validateMoveTarget(draggingPath, dropTargetParentPath, draggingIsDir);
    if (validationError) {
      showError(validationError);
      get().endDrag(voltId);
      return null;
    }

    if (draggingIsDir && isFolderMoveIntoOwnSubtree(draggingPath, dropTargetParentPath)) {
      showError('Cannot move a folder into itself');
      get().endDrag(voltId);
      return null;
    }

    const nextPath = buildMovedPath(draggingPath, dropTargetParentPath);

    try {
      await renameNote(voltPath, draggingPath, nextPath);

      if (draggingIsDir) {
        useTabStore.getState().replacePathPrefix(voltId, draggingPath, nextPath);
      } else {
        useTabStore.getState().renamePath(voltId, draggingPath, nextPath);
      }

      set((state) => ({
        ...clearDragState(state, voltId),
        selectedPath: {
          ...state.selectedPath,
          [voltId]: nextPath,
        },
        expandedPaths: {
          ...state.expandedPaths,
          [voltId]: draggingIsDir
            ? (dropTargetParentPath
                ? setExpanded(
                    replacePathPrefixInList(getExpandedPaths(state, voltId), draggingPath, nextPath),
                    dropTargetParentPath,
                  )
                : replacePathPrefixInList(getExpandedPaths(state, voltId), draggingPath, nextPath))
            : setExpanded(getExpandedPaths(state, voltId), dropTargetParentPath),
        },
      }));

      showSuccess(`Moved "${getEntryDisplayName(getPathBasename(nextPath), draggingIsDir)}"`);
      await get().refreshTree(voltId, voltPath);
      return nextPath;
    } catch (err) {
      showError((err as Error).message);
      return null;
    } finally {
      get().endDrag(voltId);
    }
  },

  scheduleHoverExpand: (voltId, path) => {
    if (getExpandedPaths(get(), voltId).includes(path) && get().hoverExpandPath[voltId] !== path) {
      return;
    }

    if (get().hoverExpandPath[voltId] === path) {
      return;
    }

    clearHoverExpandTimer(voltId);
    set((state) => ({
      hoverExpandPath: {
        ...state.hoverExpandPath,
        [voltId]: path,
      },
    }));

    const timer = setTimeout(() => {
      hoverExpandTimers.delete(voltId);
      set((state) => {
        if (state.hoverExpandPath[voltId] !== path) {
          return {};
        }

        return {
          expandedPaths: {
            ...state.expandedPaths,
            [voltId]: setExpanded(getExpandedPaths(state, voltId), path),
          },
          hoverExpandPath: {
            ...state.hoverExpandPath,
            [voltId]: null,
          },
        };
      });
    }, HOVER_EXPAND_DELAY_MS);

    hoverExpandTimers.set(voltId, timer);
  },

  cancelHoverExpand: (voltId, path) => {
    const currentPath = get().hoverExpandPath[voltId];
    if (path && currentPath !== path) {
      return;
    }

    clearHoverExpandTimer(voltId);
    set((state) => ({
      hoverExpandPath: {
        ...state.hoverExpandPath,
        [voltId]: null,
      },
    }));
  },
}));
