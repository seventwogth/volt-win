import { useEffect } from 'react';
import { useFileTreeStore } from '@app/stores/fileTreeStore';
import { useTabStore } from '@app/stores/tabStore';

interface UseKeyboardShortcutsOptions {
  voltId: string;
  voltPath: string;
}

export function useKeyboardShortcuts({ voltId, voltPath }: UseKeyboardShortcutsOptions) {
  const getActiveTab = () => {
    const state = useTabStore.getState();
    const activeTabId = state.activeTabs[voltId] ?? null;
    if (!activeTabId) return null;
    const voltTabs = state.tabs[voltId] ?? [];
    return voltTabs.find((t) => t.id === activeTabId) ?? null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key) {
        case 's': {
          e.preventDefault();
          const tab = getActiveTab();
          if (tab && tab.type === 'file' && tab.filePath) {
            // Dispatch a custom event that the editor can listen to for saving
            window.dispatchEvent(new CustomEvent('volt:save-active-file'));
          }
          break;
        }
        case 'w': {
          e.preventDefault();
          const tab = getActiveTab();
          if (tab) {
            useTabStore.getState().closeTab(voltId, tab.id);
          }
          break;
        }
        case 'n': {
          e.preventDefault();
          useFileTreeStore.getState().startCreate(voltId, '', false);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voltId, voltPath]);
}
