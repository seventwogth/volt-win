import { useEffect } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { useWorkspaceStore } from '@entities/workspace';
import { loadAllPlugins, unloadAllPlugins } from '@shared/lib/plugin-runtime';

export function useWorkspaceRuntimeRoute(
  voltId: string | undefined,
  navigate: NavigateFunction,
) {
  const { workspaces, activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
  const workspace = workspaces.find((entry) => entry.voltId === voltId);

  useEffect(() => {
    if (workspace) {
      void loadAllPlugins(workspace.voltPath);
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
      return;
    }

    if (!workspace && voltId) {
      navigate('/');
    }
  }, [activeWorkspaceId, navigate, setActiveWorkspace, voltId, workspace]);

  useEffect(() => {
    const handlePluginNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ voltId: string; pageId: string }>).detail;
      if (!detail || detail.voltId !== voltId) {
        return;
      }

      navigate(`/workspace/${detail.voltId}/plugin/${encodeURIComponent(detail.pageId)}`);
    };

    window.addEventListener('volt:navigate-plugin-page', handlePluginNavigation);
    return () => {
      window.removeEventListener('volt:navigate-plugin-page', handlePluginNavigation);
    };
  }, [navigate, voltId]);

  return workspace ?? null;
}
