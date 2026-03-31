import type { SearchResult } from './types';
import { invokeWailsSafe } from '@shared/api/wailsWithError';
import { normalizeWorkspaceSearchResult } from '@shared/lib/workspacePath';

const loadSearchHandler = () => import('../../../../wailsjs/go/wailshandler/SearchHandler');

export async function searchFiles(voltPath: string, query: string): Promise<SearchResult[]> {
  const results = await invokeWailsSafe(loadSearchHandler, (mod) => mod.SearchFiles(voltPath, query), 'searchFiles');
  return results.map(normalizeWorkspaceSearchResult);
}
