import type { FileEntry } from '@api/note/types';

const MARKDOWN_EXTENSION = '.md';

export type FileTreeDropPosition = 'inside' | 'before' | 'after';

export function isMarkdownName(name: string): boolean {
  return name.toLowerCase().endsWith(MARKDOWN_EXTENSION);
}

export function stripMarkdownExtension(name: string): string {
  return isMarkdownName(name) ? name.slice(0, -MARKDOWN_EXTENSION.length) : name;
}

export function ensureMarkdownFileName(name: string): string {
  return isMarkdownName(name) ? name : `${name}${MARKDOWN_EXTENSION}`;
}

export function getEntryDisplayName(name: string, isDir: boolean): string {
  if (isDir) {
    return name;
  }

  return stripMarkdownExtension(name);
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

export function buildRenamedFilePath(path: string, nextName: string, preserveMarkdownExtension: boolean): string {
  const trimmed = nextName.trim();
  const normalizedName = preserveMarkdownExtension ? ensureMarkdownFileName(trimmed) : trimmed;
  return joinRelativePath(getParentPath(path), normalizedName);
}

export function buildMovedPath(path: string, destinationParentPath: string): string {
  return joinRelativePath(destinationParentPath, getPathBasename(path));
}

export function validateInlineName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return 'Name cannot be empty';
  }

  if (trimmed === '.' || trimmed === '..') {
    return 'Name is not valid';
  }

  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Use a single name, not a path';
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
    return 'Item is already in this folder';
  }

  if (isDir && isFolderMoveIntoOwnSubtree(sourcePath, destinationParentPath)) {
    return 'Cannot move a folder into itself';
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
