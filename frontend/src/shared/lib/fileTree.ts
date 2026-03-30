import type { FileEntry } from '@shared/api/file/types';
import { translate } from '@shared/i18n';
import {
  MARKDOWN_EXTENSION,
  ensureExtension,
  getHiddenDisplayExtension,
  isMarkdownName,
  stripHiddenDisplayExtension,
} from './fileTypes';

export type FileTreeDropPosition = 'inside' | 'before' | 'after';
export { isMarkdownName };

export function stripMarkdownExtension(name: string): string {
  return isMarkdownName(name) ? name.slice(0, -MARKDOWN_EXTENSION.length) : name;
}

export function ensureMarkdownFileName(name: string): string {
  return ensureExtension(name, MARKDOWN_EXTENSION);
}

export function ensureFileNameExtension(name: string, extension: string): string {
  return ensureExtension(name, extension);
}

export function getEntryDisplayName(name: string, isDir: boolean): string {
  if (isDir) {
    return name;
  }

  return stripHiddenDisplayExtension(name);
}

export function getPathBasename(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.at(-1) ?? path;
}

export function getParentPath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return '';
  }

  return segments.slice(0, -1).join('/');
}

export function joinRelativePath(parentPath: string, childName: string): string {
  return parentPath ? `${parentPath}/${childName}` : childName;
}

export function buildRenamedPath(path: string, nextName: string, isDir: boolean): string {
  const trimmed = nextName.trim();
  const normalizedName = isDir ? trimmed : trimmed;
  return joinRelativePath(getParentPath(path), normalizedName);
}

export function buildRenamedFilePath(path: string, nextName: string, preservedExtension?: string | null): string {
  const trimmed = nextName.trim();
  const normalizedName = preservedExtension ? ensureExtension(trimmed, preservedExtension) : trimmed;
  return joinRelativePath(getParentPath(path), normalizedName);
}

export function buildMovedPath(path: string, destinationParentPath: string): string {
  return joinRelativePath(destinationParentPath, getPathBasename(path));
}

export function validateInlineName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return translate('fileTree.validation.emptyName');
  }

  if (trimmed === '.' || trimmed === '..') {
    return translate('fileTree.validation.invalidName');
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return translate('fileTree.validation.singleName');
  }

  return null;
}

export function hasPathPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  if (!hasPathPrefix(path, oldPrefix)) {
    return path;
  }

  return newPrefix + path.slice(oldPrefix.length);
}

export function replacePathPrefixInList(paths: string[], oldPrefix: string, newPrefix: string): string[] {
  return paths.map((path) => replacePathPrefix(path, oldPrefix, newPrefix));
}

export function removePathPrefixFromList(paths: string[], prefix: string): string[] {
  return paths.filter((path) => !hasPathPrefix(path, prefix));
}

export function getTabLabelFromPath(path: string): string {
  return getEntryDisplayName(getPathBasename(path), false);
}

export function getPreservedDisplayExtension(name: string): string | null {
  return getHiddenDisplayExtension(name);
}

export function getDropPositionForPointer(
  offsetY: number,
  itemHeight: number,
  isDir: boolean,
): FileTreeDropPosition {
  const topBoundary = itemHeight * 0.25;
  const bottomBoundary = itemHeight * 0.75;

  if (offsetY <= topBoundary) {
    return 'before';
  }

  if (offsetY >= bottomBoundary) {
    return 'after';
  }

  if (isDir) {
    return 'inside';
  }

  return offsetY < itemHeight / 2 ? 'before' : 'after';
}

export function getDropParentPath(entry: Pick<FileEntry, 'path' | 'isDir'>, position: FileTreeDropPosition): string {
  if (position === 'inside' && entry.isDir) {
    return entry.path;
  }

  return getParentPath(entry.path);
}

export function isFolderMoveIntoOwnSubtree(sourcePath: string, destinationParentPath: string): boolean {
  return destinationParentPath === sourcePath || hasPathPrefix(destinationParentPath, sourcePath);
}

export function validateMoveTarget(
  sourcePath: string,
  destinationParentPath: string,
  isDir: boolean,
): string | null {
  const nextPath = buildMovedPath(sourcePath, destinationParentPath);

  if (nextPath === sourcePath) {
    return translate('fileTree.validation.itemAlreadyInFolder');
  }

  if (isDir && isFolderMoveIntoOwnSubtree(sourcePath, destinationParentPath)) {
    return translate('fileTree.validation.cannotMoveFolderIntoItself');
  }

  return null;
}

export function findEntryByPath(entries: FileEntry[], targetPath: string): FileEntry | null {
  for (const entry of entries) {
    if (entry.path === targetPath) {
      return entry;
    }

    if (entry.isDir && entry.children) {
      const child = findEntryByPath(entry.children, targetPath);
      if (child) {
        return child;
      }
    }
  }

  return null;
}
