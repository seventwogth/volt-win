import { useCallback, useEffect, useRef, useState } from 'react';
import { useFileTreeStore } from '@app/stores/fileTreeStore';
import { useTabStore } from '@app/stores/tabStore';
import { FileTree } from '@widgets/file-tree/FileTree';
import { Icon } from '@uikit/icon';
import styles from './Sidebar.module.scss';

const STORAGE_KEY = 'volt-sidebar-width';
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;

function getInitialWidth(): number {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const n = Number(saved);
    if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return 240;
}

interface SidebarProps {
  voltId: string;
  voltPath: string;
  onSearchClick: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ voltId, voltPath, onSearchClick, collapsed, onToggleCollapse }: SidebarProps) {
  const openGraphTab = useTabStore((s) => s.openGraphTab);
  const startCreate = useFileTreeStore((state) => state.startCreate);
  const notifyFsMutation = useFileTreeStore((state) => state.notifyFsMutation);
  const [width, setWidth] = useState(getInitialWidth);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(next);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  return (
    <aside className={collapsed ? styles.collapsed : styles.sidebar} style={!collapsed ? { width, minWidth: width } : undefined}>
      <div className={styles.topBar}>
        <button className={styles.iconButton} onClick={onSearchClick} title="Search">
          <Icon name="search" size={18} />
        </button>
        {collapsed ? (
          <button className={styles.iconButton} onClick={() => openGraphTab(voltId)} title="Graph">
            <Icon name="graph" size={18} />
          </button>
        ) : (
          <>
            <button className={styles.iconButton} onClick={() => startCreate(voltId, '', false)} title="New note">
              <Icon name="plus" size={18} />
            </button>
            <button className={styles.iconButton} onClick={() => startCreate(voltId, '', true)} title="New folder">
              <Icon name="folder" size={18} />
            </button>
            <button className={styles.iconButton} onClick={() => void notifyFsMutation(voltId, voltPath)} title="Refresh files">
              <Icon name="refreshCw" size={18} />
            </button>
            <div className={styles.spacer} />
          </>
        )}
        <button className={styles.iconButton} onClick={onToggleCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name="panelLeft" size={18} />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className={styles.treeContainer}>
            <FileTree voltId={voltId} voltPath={voltPath} />
          </div>
          <div className={styles.bottom}>
            <button className={styles.themeToggle} onClick={() => openGraphTab(voltId)}>
              <Icon name="graph" size={16} /> Graph
            </button>
          </div>
          <div className={styles.resizeHandle} onMouseDown={onMouseDown} />
        </>
      )}
    </aside>
  );
}
