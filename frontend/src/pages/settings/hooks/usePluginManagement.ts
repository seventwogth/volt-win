import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppSettingsStore } from '@entities/app-settings';
import { usePluginLogStore, usePluginSettingsStore } from '@entities/plugin';
import { useWorkspaceStore } from '@entities/workspace';
import {
  deletePlugin,
  getPluginsDirectory,
  importPluginArchive,
  listPlugins,
  pickPluginArchive,
  setPluginEnabled,
} from '@shared/api/plugin';
import type { PluginInfo } from '@shared/api/plugin';
import { loadSinglePlugin, unloadSinglePlugin } from '@shared/lib/plugin-runtime';
import { notifyError, notifySuccess, notifyInfo } from '@shared/ui/toast';
import { useI18n } from '@app/providers/I18nProvider';

function sortPlugins(plugins: PluginInfo[]): PluginInfo[] {
  return [...plugins].sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));
}

function upsertPlugin(currentPlugins: PluginInfo[], nextPlugin: PluginInfo): PluginInfo[] {
  const existingIndex = currentPlugins.findIndex((plugin) => plugin.manifest.id === nextPlugin.manifest.id);
  if (existingIndex === -1) {
    return sortPlugins([...currentPlugins, nextPlugin]);
  }
  const nextPlugins = [...currentPlugins];
  nextPlugins[existingIndex] = nextPlugin;
  return sortPlugins(nextPlugins);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePluginManagement() {
  const { t } = useI18n();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const clearPluginShortcutOverrides = useAppSettingsStore((state) => state.clearPluginShortcutOverrides);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [pluginsDirectory, setPluginsDirectory] = useState('');
  const [pluginsLoaded, setPluginsLoaded] = useState(false);
  const [confirmPlugin, setConfirmPlugin] = useState<PluginInfo | null>(null);
  const [pluginPendingDeletion, setPluginPendingDeletion] = useState<PluginInfo | null>(null);
  const [importingPlugin, setImportingPlugin] = useState(false);
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [deletingPluginId, setDeletingPluginId] = useState<string | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.voltId === activeWorkspaceId) ?? null;

  const fetchPlugins = useCallback(async () => {
    try {
      const [list, directory] = await Promise.all([
        listPlugins(),
        getPluginsDirectory(),
      ]);
      setPlugins(sortPlugins(list));
      setPluginsDirectory(directory);
    } catch (err) {
      console.error('Failed to load plugins:', err);
      notifyError(getErrorMessage(err));
    } finally {
      setPluginsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchPlugins();
  }, [fetchPlugins]);

  const applyPluginToggle = useCallback(async (plugin: PluginInfo, nextEnabled: boolean) => {
    const pluginId = plugin.manifest.id;
    setBusyPluginId(pluginId);

    try {
      await setPluginEnabled(pluginId, nextEnabled);
      setPlugins((prev) =>
        prev.map((current) =>
          current.manifest.id === pluginId ? { ...current, enabled: nextEnabled } : current,
        ),
      );

      if (nextEnabled) {
        if (activeWorkspace?.voltPath) {
          await loadSinglePlugin(pluginId, activeWorkspace.voltPath);
        }
      } else {
        unloadSinglePlugin(pluginId);
      }
    } catch (err) {
      console.error('Failed to toggle plugin:', err);
      notifyError(getErrorMessage(err));
      throw err;
    } finally {
      setBusyPluginId((current) => (current === pluginId ? null : current));
    }
  }, [activeWorkspace?.voltPath]);

  const handleTogglePlugin = useCallback(async (plugin: PluginInfo) => {
    if (!plugin.enabled && plugin.manifest.permissions.length > 0) {
      setConfirmPlugin(plugin);
      return;
    }

    try {
      await applyPluginToggle(plugin, !plugin.enabled);
    } catch {
      return;
    }
  }, [applyPluginToggle]);

  const handleImportPlugin = useCallback(async () => {
    setImportingPlugin(true);

    try {
      let archivePath: string;
      try {
        archivePath = await pickPluginArchive();
      } catch (err) {
        console.error('Failed to open plugin archive dialog:', err);
        notifyError(getErrorMessage(err));
        return;
      }

      if (!archivePath) {
        return;
      }

      let importedPlugin: PluginInfo;
      try {
        importedPlugin = await importPluginArchive(archivePath);
      } catch (err) {
        console.error('Failed to import plugin:', err);
        notifyError(getErrorMessage(err));
        return;
      }

      setPlugins((prev) => upsertPlugin(prev, importedPlugin));

      if (importedPlugin.manifest.permissions.length > 0) {
        setConfirmPlugin(importedPlugin);
        notifyInfo(t('settings.plugins.importSuccess', { name: importedPlugin.manifest.name }));
        return;
      }

      try {
        await applyPluginToggle(importedPlugin, true);
      } catch {
        return;
      }

      notifySuccess(t('settings.plugins.importEnabledSuccess', { name: importedPlugin.manifest.name }));
    } finally {
      setImportingPlugin(false);
    }
  }, [applyPluginToggle, t]);

  const handleConfirmDeletePlugin = useCallback(async () => {
    const plugin = pluginPendingDeletion;
    if (!plugin) {
      return;
    }

    const pluginId = plugin.manifest.id;
    setDeletingPluginId(pluginId);

    try {
      await deletePlugin(pluginId);
      unloadSinglePlugin(pluginId);
      usePluginLogStore.getState().clearByPlugin(pluginId);
      usePluginSettingsStore.getState().clearPluginValues(pluginId);
      clearPluginShortcutOverrides(pluginId);

      setPlugins((prev) => prev.filter((current) => current.manifest.id !== pluginId));
      setConfirmPlugin((current) => (current?.manifest.id === pluginId ? null : current));
      setPluginPendingDeletion(null);
      notifySuccess(t('settings.plugins.deleteSuccess', { name: plugin.manifest.name }));
    } catch (err) {
      console.error('Failed to delete plugin:', err);
      notifyError(getErrorMessage(err));
    } finally {
      setDeletingPluginId((current) => (current === pluginId ? null : current));
    }
  }, [clearPluginShortcutOverrides, pluginPendingDeletion, t]);

  const settingsPlugins = useMemo(
    () => [...plugins]
      .filter((plugin) => plugin.enabled)
      .filter((plugin) => (plugin.manifest.settings?.sections ?? []).length > 0)
      .sort((left, right) => left.manifest.name.localeCompare(right.manifest.name)),
    [plugins],
  );

  return {
    plugins,
    pluginsDirectory,
    pluginsLoaded,
    settingsPlugins,
    confirmPlugin,
    setConfirmPlugin,
    pluginPendingDeletion,
    setPluginPendingDeletion,
    importingPlugin,
    busyPluginId,
    deletingPluginId,
    handleTogglePlugin,
    handleImportPlugin,
    handleConfirmDeletePlugin,
    applyPluginToggle,
  };
}
