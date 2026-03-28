import { create } from 'zustand';
import {
  getTabLabelFromPath,
  hasPathPrefix,
  replacePathPrefix,
} from '@app/lib/fileTree';

export type TabType = 'file' | 'graph';

export interface FileTab {
  id: string;
  type: TabType;
  filePath: string;
  fileName: string;
  isDirty: boolean;
}

interface PendingRename {
  oldPath: string;
  newPath: string;
}

interface TabState {
  tabs: Record<string, FileTab[]>;
  activeTabs: Record<string, string | null>;
  pendingRenames: Record<string, PendingRename | null>;
  openTab: (voltId: string, filePath: string, fileName: string) => void;
  openGraphTab: (voltId: string) => void;
  closeTab: (voltId: string, tabId: string) => void;
  setActiveTab: (voltId: string, tabId: string) => void;
  setDirty: (voltId: string, tabId: string, dirty: boolean) => void;
  reorderTabs: (voltId: string, fromIndex: number, toIndex: number) => void;
  renamePath: (voltId: string, oldPath: string, newPath: string) => void;
  replacePathPrefix: (voltId: string, oldPrefix: string, newPrefix: string) => void;
  removePath: (voltId: string, filePath: string) => void;
  removePathPrefix: (voltId: string, prefix: string) => void;
  consumePendingRename: (voltId: string, newPath?: string) => void;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: {},
  activeTabs: {},
  pendingRenames: {},

  openTab: (voltId, filePath, fileName) => {
    const { tabs, activeTabs } = get();
    const voltTabs = tabs[voltId] ?? [];
    const exists = voltTabs.find((t) => t.id === filePath);
    const normalizedFileName = getTabLabelFromPath(filePath) || fileName;

    if (exists) {
      set({
        tabs: {
          ...tabs,
          [voltId]: voltTabs.map((tab) => (
            tab.id === filePath ? { ...tab, fileName: normalizedFileName } : tab
          )),
        },
        activeTabs: { ...activeTabs, [voltId]: filePath },
      });
    } else {
      const newTab: FileTab = { id: filePath, type: 'file', filePath, fileName: normalizedFileName, isDirty: false };
      set({
        tabs: { ...tabs, [voltId]: [...voltTabs, newTab] },
        activeTabs: { ...activeTabs, [voltId]: filePath },
      });
    }
  },

  openGraphTab: (voltId) => {
    const GRAPH_TAB_ID = '__graph__';
    const { tabs, activeTabs } = get();
    const voltTabs = tabs[voltId] ?? [];
    const exists = voltTabs.find((t) => t.id === GRAPH_TAB_ID);

    if (exists) {
      set({ activeTabs: { ...activeTabs, [voltId]: GRAPH_TAB_ID } });
    } else {
      const newTab: FileTab = {
        id: GRAPH_TAB_ID,
        type: 'graph',
        filePath: '',
        fileName: 'Graph',
        isDirty: false,
      };
      set({
        tabs: { ...tabs, [voltId]: [...voltTabs, newTab] },
        activeTabs: { ...activeTabs, [voltId]: GRAPH_TAB_ID },
      });
    }
  },

  closeTab: (voltId, tabId) => {
    const { tabs, activeTabs } = get();
    const voltTabs = tabs[voltId] ?? [];
    const idx = voltTabs.findIndex((t) => t.id === tabId);
    const filtered = voltTabs.filter((t) => t.id !== tabId);

    let newActive = activeTabs[voltId];
    if (newActive === tabId) {
      if (filtered.length > 0) {
        const newIdx = Math.min(idx, filtered.length - 1);
        newActive = filtered[newIdx].id;
      } else {
        newActive = null;
      }
    }

    set({
      tabs: { ...tabs, [voltId]: filtered },
      activeTabs: { ...activeTabs, [voltId]: newActive },
    });
  },

  setActiveTab: (voltId, tabId) => {
    const { activeTabs } = get();
    set({ activeTabs: { ...activeTabs, [voltId]: tabId } });
  },

  setDirty: (voltId, tabId, dirty) => {
    const { tabs } = get();
    const voltTabs = tabs[voltId] ?? [];
    set({
      tabs: {
        ...tabs,
        [voltId]: voltTabs.map((t) => (t.id === tabId ? { ...t, isDirty: dirty } : t)),
      },
    });
  },

  reorderTabs: (voltId, fromIndex, toIndex) => {
    set((state) => {
      const voltTabs = [...(state.tabs[voltId] || [])];
      const [moved] = voltTabs.splice(fromIndex, 1);
      voltTabs.splice(toIndex, 0, moved);
      return { tabs: { ...state.tabs, [voltId]: voltTabs } };
    });
  },

  renamePath: (voltId, oldPath, newPath) => {
    set((state) => {
      const voltTabs = state.tabs[voltId] ?? [];
      const nextTabs = voltTabs.map((tab) => (
        tab.id === oldPath
          ? {
              ...tab,
              id: newPath,
              filePath: newPath,
              fileName: getTabLabelFromPath(newPath),
            }
          : tab
      ));

      const activeTabId = state.activeTabs[voltId];
      const isActiveRenamed = activeTabId === oldPath;

      return {
        tabs: { ...state.tabs, [voltId]: nextTabs },
        activeTabs: {
          ...state.activeTabs,
          [voltId]: isActiveRenamed ? newPath : activeTabId ?? null,
        },
        pendingRenames: {
          ...state.pendingRenames,
          [voltId]: isActiveRenamed ? { oldPath, newPath } : state.pendingRenames[voltId] ?? null,
        },
      };
    });
  },

  replacePathPrefix: (voltId, oldPrefix, newPrefix) => {
    set((state) => {
      const voltTabs = state.tabs[voltId] ?? [];
      const nextTabs = voltTabs.map((tab) => {
        if (tab.type !== 'file' || !hasPathPrefix(tab.filePath, oldPrefix)) {
          return tab;
        }

        const nextPath = replacePathPrefix(tab.filePath, oldPrefix, newPrefix);
        return {
          ...tab,
          id: nextPath,
          filePath: nextPath,
          fileName: getTabLabelFromPath(nextPath),
        };
      });

      const activeTabId = state.activeTabs[voltId];
      const nextActiveTabId = activeTabId && hasPathPrefix(activeTabId, oldPrefix)
        ? replacePathPrefix(activeTabId, oldPrefix, newPrefix)
        : activeTabId ?? null;

      const shouldTrackRename = Boolean(
        activeTabId &&
        activeTabId !== nextActiveTabId &&
        nextActiveTabId,
      );

      return {
        tabs: { ...state.tabs, [voltId]: nextTabs },
        activeTabs: { ...state.activeTabs, [voltId]: nextActiveTabId },
        pendingRenames: {
          ...state.pendingRenames,
          [voltId]: shouldTrackRename && activeTabId && nextActiveTabId
            ? { oldPath: activeTabId, newPath: nextActiveTabId }
            : state.pendingRenames[voltId] ?? null,
        },
      };
    });
  },

  removePath: (voltId, filePath) => {
    get().closeTab(voltId, filePath);
  },

  removePathPrefix: (voltId, prefix) => {
    set((state) => {
      const voltTabs = state.tabs[voltId] ?? [];
      const filtered = voltTabs.filter((tab) => tab.type !== 'file' || !hasPathPrefix(tab.filePath, prefix));
      const activeTabId = state.activeTabs[voltId];

      let nextActiveTabId = activeTabId ?? null;
      if (activeTabId && hasPathPrefix(activeTabId, prefix)) {
        const activeIndex = filtered.length - 1;
        nextActiveTabId = activeIndex >= 0 ? filtered[activeIndex].id : null;
      }

      return {
        tabs: { ...state.tabs, [voltId]: filtered },
        activeTabs: { ...state.activeTabs, [voltId]: nextActiveTabId },
      };
    });
  },

  consumePendingRename: (voltId, newPath) => {
    set((state) => {
      const pending = state.pendingRenames[voltId];
      if (!pending) {
        return state;
      }

      if (newPath && pending.newPath !== newPath) {
        return state;
      }

      return {
        pendingRenames: {
          ...state.pendingRenames,
          [voltId]: null,
        },
      };
    });
  },
}));
