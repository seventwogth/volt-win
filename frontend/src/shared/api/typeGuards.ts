import type { PluginInfo } from './plugin/types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPluginManifest(value: unknown): value is PluginInfo['manifest'] {
  if (!isObject(value)) return false;
  return (
    typeof value.apiVersion === 'number' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    typeof value.main === 'string' &&
    Array.isArray(value.permissions)
  );
}

export function asPluginInfo(value: unknown): PluginInfo {
  if (!isObject(value) || !isPluginManifest(value.manifest) || typeof value.enabled !== 'boolean') {
    throw new TypeError('Invalid PluginInfo payload');
  }
  return value as unknown as PluginInfo;
}

export function asPluginInfoList(value: unknown): PluginInfo[] {
  if (!Array.isArray(value)) {
    throw new TypeError('Expected PluginInfo array');
  }
  return value.map(asPluginInfo);
}
