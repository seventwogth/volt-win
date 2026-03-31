import type { FileEntry } from '@shared/api/file/types';
import type { SearchResult } from '@shared/api/search';

export function normalizeWorkspacePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.replaceAll('\\', '/');
  const segments = normalized.split('/');
  const resolved: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }

    if (segment === '..') {
      const previous = resolved.at(-1);
      if (previous && previous !== '..') {
        resolved.pop();
      } else {
        resolved.push(segment);
      }
      continue;
    }

    resolved.push(segment);
  }

  return resolved.join('/');
}

export function normalizeWorkspaceFileEntry(entry: FileEntry): FileEntry {
  return {
    ...entry,
    path: normalizeWorkspacePath(entry.path),
    children: entry.children?.map(normalizeWorkspaceFileEntry),
  };
}

export function normalizeWorkspaceSearchResult(result: SearchResult): SearchResult {
  return {
    ...result,
    filePath: normalizeWorkspacePath(result.filePath),
  };
}
