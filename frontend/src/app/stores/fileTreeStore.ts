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
  buildRenamedPath,
  buildRenamedFilePath,
  ensureMarkdownFileName,
  findEntryByPath,
  getEntryDisplayName,
  getParentPath,
  getPathBasename,
  hasPathPrefix,
  isMarkdownName,
  joinRelativePath,
  removePathPrefixFromList,
  replacePathPrefix,
  replacePathPrefixInList,
  validateInlineName,
} from '@app/lib/fileTree';
import { useToastStore } from './toastStore';
import { useTabStore } from './tabStore';

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
    set({
      pendingCreate: {
        ...get().pendingCreate,
        [voltId]: {
          parentPath,
          isDir,
          value: '',
        },
      },
      editingItem: {
        ...get().editingItem,
        [voltId]: null,
      },
      expandedPaths: {
        ...get().expandedPaths,
        [voltId]: expanded,
      },
      selectedPath: {
        ...get().selectedPath,
        [voltId]: parentPath || null,
      },
    });
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

    set({
      editingItem: {
        ...get().editingItem,
        [voltId]: {
          path,
          isDir: entry.isDir,
          value: getEntryDisplayName(entry.name, entry.isDir),
          isMarkdown: !entry.isDir && isMarkdownName(entry.name),
        },
      },
      pendingCreate: {
        ...get().pendingCreate,
        [voltId]: null,
      },
      selectedPath: {
        ...get().selectedPath,
        [voltId]: path,
      },
    });
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

    set({
      pendingDelete: {
        ...get().pendingDelete,
        [voltId]: {
          path,
          name: getEntryDisplayName(entry.name, entry.isDir),
          isDir: entry.isDir,
        },
      },
      ...clearMutationState(get(), voltId),
      selectedPath: {
        ...get().selectedPath,
        [voltId]: path,
      },
    });
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
}));
