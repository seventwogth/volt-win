import type { FileEntry } from './types';
import { invokeWailsSafe } from '@shared/api/wailsWithError';
import { normalizeWorkspaceFileEntry, normalizeWorkspacePath } from '@shared/lib/workspacePath';

const loadFileHandler = () => import('../../../../wailsjs/go/wailshandler/FileHandler');

export async function readFile(voltPath: string, filePath: string): Promise<string> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.ReadFile(voltPath, normalizeWorkspacePath(filePath)), 'readFile');
}

export async function writeFile(voltPath: string, filePath: string, content: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.WriteFile(voltPath, normalizeWorkspacePath(filePath), content), 'writeFile');
}

export async function listTree(voltPath: string, dirPath: string = ''): Promise<FileEntry[]> {
  const entries = await invokeWailsSafe(loadFileHandler, (mod) => mod.ListTree(voltPath, normalizeWorkspacePath(dirPath)), 'listTree');
  return entries.map(normalizeWorkspaceFileEntry);
}

export async function createFile(voltPath: string, filePath: string, content = ''): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.CreateFile(voltPath, normalizeWorkspacePath(filePath), content), 'createFile');
}

export async function createDirectory(voltPath: string, dirPath: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.CreateDirectory(voltPath, normalizeWorkspacePath(dirPath)), 'createDirectory');
}

export async function deletePath(voltPath: string, filePath: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.DeletePath(voltPath, normalizeWorkspacePath(filePath)), 'deletePath');
}

export async function renamePath(voltPath: string, oldPath: string, newPath: string): Promise<void> {
  return invokeWailsSafe(
    loadFileHandler,
    (mod) => mod.RenamePath(voltPath, normalizeWorkspacePath(oldPath), normalizeWorkspacePath(newPath)),
    'renamePath',
  );
}
