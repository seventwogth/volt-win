import type { FileEntry } from './types';
import { invokeWailsSafe } from '@shared/api/wailsWithError';

const loadFileHandler = () => import('../../../../wailsjs/go/wailshandler/FileHandler');

export async function readFile(voltPath: string, filePath: string): Promise<string> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.ReadFile(voltPath, filePath), 'readFile');
}

export async function writeFile(voltPath: string, filePath: string, content: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.WriteFile(voltPath, filePath, content), 'writeFile');
}

export async function listTree(voltPath: string, dirPath: string = ''): Promise<FileEntry[]> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.ListTree(voltPath, dirPath), 'listTree');
}

export async function createNote(voltPath: string, filePath: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.CreateNote(voltPath, filePath), 'createNote');
}

export async function createFile(voltPath: string, filePath: string, content = ''): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.CreateFile(voltPath, filePath, content), 'createFile');
}

export async function createDirectory(voltPath: string, dirPath: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.CreateDirectory(voltPath, dirPath), 'createDirectory');
}

export async function deletePath(voltPath: string, filePath: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.DeletePath(voltPath, filePath), 'deletePath');
}

export async function renamePath(voltPath: string, oldPath: string, newPath: string): Promise<void> {
  return invokeWailsSafe(loadFileHandler, (mod) => mod.RenamePath(voltPath, oldPath, newPath), 'renamePath');
}
