import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@app/stores/workspaceStore';
import { useTabStore, type FileTab } from '@app/stores/tabStore';
import { Sidebar } from '@widgets/sidebar/Sidebar';
import { FileTabs } from '@widgets/file-tabs/FileTabs';
import { EditorPanel } from '@widgets/editor-panel/EditorPanel';
import { GraphView } from '@widgets/graph-view/GraphView';
import { ImageViewer } from '@widgets/image-viewer/ImageViewer';
import { SearchPopup } from '@widgets/search-popup/SearchPopup';
import { loadAllPlugins, unloadAllPlugins } from '@app/plugins/pluginLoader';
import { useDoubleShift } from '../../hooks/useDoubleShift';
import { useKeyboardShortcuts } from '@app/hooks/useKeyboardShortcuts';
import styles from './WorkspacePage.module.scss';

export function WorkspacePage() {
  const { voltId } = useParams<{ voltId: string }>();
  const navigate = useNavigate();
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const activeTabs = useTabStore((s) => s.activeTabs);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('volt-sidebar-collapsed') === 'true');

  const workspace = workspaces.find((w) => w.voltId === voltId);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('volt-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({ voltId: voltId ?? '', voltPath: workspace?.voltPath ?? '' });

  // Double-Shift to toggle search popup
  useDoubleShift(toggleSearch);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load plugins on workspace mount
  useEffect(() => {
    if (workspace) {
      loadAllPlugins(workspace.voltPath);
    }
    return () => {
      unloadAllPlugins();
    };
  }, [workspace]);

  useEffect(() => {
    if (voltId && workspace) {
      if (activeWorkspaceId !== voltId) {
        setActiveWorkspace(voltId);
      }
    } else if (!workspace && voltId) {
      // Workspace not found in store, navigate home
      navigate('/');
    }
  }, [voltId, workspace, activeWorkspaceId, setActiveWorkspace, navigate]);

  if (!workspace || !voltId) {
    return null;
  }

  const activeTabId = activeTabs[voltId] ?? null;
  const allTabs = useTabStore((s) => s.tabs);
  const voltTabs: FileTab[] = allTabs[voltId] ?? [];
  const activeTab = voltTabs.find((t) => t.id === activeTabId) ?? null;
  const openTab = useTabStore((s) => s.openTab);

  const handleGraphNodeOpen = useCallback(
    (filePath: string) => {
      const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') ?? filePath;
      openTab(voltId, filePath, fileName);
    },
    [voltId, openTab],
  );

  const isGraphTab = activeTab?.type === 'graph';
  const activeFilePath = isGraphTab ? null : (activeTabId ?? null);
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const isImageFile = activeFilePath != null && imageExtensions.some((ext) => activeFilePath.toLowerCase().endsWith(ext));

  return (
    <div className={styles.layout}>
      <Sidebar
        voltId={voltId}
        voltPath={workspace.voltPath}
        onSearchClick={() => setSearchOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />
      <div className={styles.main}>
        <FileTabs voltId={voltId} />
        {isGraphTab ? (
          <GraphView voltPath={workspace.voltPath} onNodeOpen={handleGraphNodeOpen} />
        ) : isImageFile ? (
          <ImageViewer voltPath={workspace.voltPath} filePath={activeFilePath} />
        ) : (
          <EditorPanel
            voltId={voltId}
            voltPath={workspace.voltPath}
            filePath={activeFilePath}
          />
        )}
      </div>
      {searchOpen && (
        <SearchPopup
          isOpen={searchOpen}
          onClose={closeSearch}
          voltId={voltId}
          voltPath={workspace.voltPath}
        />
      )}
    </div>
  );
}
