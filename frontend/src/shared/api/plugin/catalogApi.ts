import type { PluginInfo } from './types';
import { invokeWailsSafe } from '@shared/api/wailsWithError';
import { asPluginInfo, asPluginInfoList } from '@shared/api/typeGuards';

const loadPluginCatalogHandler = () => import('../../../../wailsjs/go/wailshandler/PluginCatalogHandler');

export async function listPlugins(): Promise<PluginInfo[]> {
  const plugins = await invokeWailsSafe(loadPluginCatalogHandler, (mod) => mod.ListPlugins(), 'listPlugins');
  return asPluginInfoList(plugins);
}

export async function getPluginsDirectory(): Promise<string> {
  return invokeWailsSafe(loadPluginCatalogHandler, (mod) => mod.GetPluginsDirectory(), 'getPluginsDirectory');
}

export async function pickPluginArchive(): Promise<string> {
  return invokeWailsSafe(loadPluginCatalogHandler, (mod) => mod.PickPluginArchive(), 'pickPluginArchive');
}

export async function importPluginArchive(archivePath: string): Promise<PluginInfo> {
  const plugin = await invokeWailsSafe(loadPluginCatalogHandler, (mod) => mod.ImportPluginArchive(archivePath), 'importPluginArchive');
  return asPluginInfo(plugin);
}

export async function deletePlugin(pluginId: string): Promise<void> {
  return invokeWailsSafe(loadPluginCatalogHandler, (mod) => mod.DeletePlugin(pluginId), 'deletePlugin');
}

export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  return invokeWailsSafe(loadPluginCatalogHandler, (mod) => mod.SetPluginEnabled(pluginId, enabled), 'setPluginEnabled');
}
