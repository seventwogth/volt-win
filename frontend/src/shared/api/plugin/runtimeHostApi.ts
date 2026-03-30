import { invokeWailsSafe } from '@shared/api/wailsWithError';

const loadPluginRuntimeHandler = () => import('../../../../wailsjs/go/wailshandler/PluginRuntimeHandler');

export async function loadPluginSource(pluginId: string): Promise<string> {
  return invokeWailsSafe(loadPluginRuntimeHandler, (mod) => mod.LoadPluginSource(pluginId), 'loadPluginSource');
}

export async function getPluginData(pluginId: string, key: string): Promise<string> {
  return invokeWailsSafe(loadPluginRuntimeHandler, (mod) => mod.GetPluginData(pluginId, key), 'getPluginData');
}

export async function setPluginData(pluginId: string, key: string, value: string): Promise<void> {
  return invokeWailsSafe(loadPluginRuntimeHandler, (mod) => mod.SetPluginData(pluginId, key, value), 'setPluginData');
}

export async function pickPluginFiles(
  title: string,
  accept: string[],
  multiple: boolean,
): Promise<string[]> {
  return invokeWailsSafe(
    loadPluginRuntimeHandler,
    (mod) => mod.PickPluginFiles(title, accept, multiple),
    'pickPluginFiles',
  );
}

export async function copyPluginAsset(
  voltPath: string,
  sourcePath: string,
  targetDir: string,
): Promise<string> {
  return invokeWailsSafe(
    loadPluginRuntimeHandler,
    (mod) => mod.CopyPluginAsset(voltPath, sourcePath, targetDir),
    'copyPluginAsset',
  );
}

export async function startPluginProcess(
  runId: string,
  voltPath: string,
  command: string,
  args: string[],
  stdin: string,
  stdoutMode: 'raw' | 'lines',
  stderrMode: 'raw' | 'lines',
): Promise<void> {
  return invokeWailsSafe(loadPluginRuntimeHandler, (mod) =>
    mod.StartPluginProcess(runId, voltPath, command, args, stdin, stdoutMode, stderrMode),
  'startPluginProcess');
}

export async function cancelPluginProcess(runId: string): Promise<void> {
  return invokeWailsSafe(loadPluginRuntimeHandler, (mod) => mod.CancelPluginProcess(runId), 'cancelPluginProcess');
}
