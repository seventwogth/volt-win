import type { PluginInfo } from './types';
import { invokeWails } from '@api/wails';

const loadPluginHandler = () => import('../../../wailsjs/go/wailshandler/PluginHandler');

export async function listPlugins(): Promise<PluginInfo[]> {
  return invokeWails(loadPluginHandler, (mod) => mod.ListPlugins());
}

export async function loadPluginSource(pluginId: string): Promise<string> {
  return invokeWails(loadPluginHandler, (mod) => mod.LoadPluginSource(pluginId));
}

export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  return invokeWails(loadPluginHandler, (mod) => mod.SetPluginEnabled(pluginId, enabled));
}

export async function getPluginData(pluginId: string, key: string): Promise<string> {
  return invokeWails(loadPluginHandler, (mod) => mod.GetPluginData(pluginId, key));
}

export async function setPluginData(pluginId: string, key: string, value: string): Promise<void> {
  return invokeWails(loadPluginHandler, (mod) => mod.SetPluginData(pluginId, key, value));
}
