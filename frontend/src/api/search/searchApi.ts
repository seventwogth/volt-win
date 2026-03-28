import type { SearchResult } from './types';
import { invokeWails } from '@api/wails';

const loadSearchHandler = () => import('../../../wailsjs/go/wailshandler/SearchHandler');

export async function searchFiles(voltPath: string, query: string): Promise<SearchResult[]> {
  return invokeWails(loadSearchHandler, (mod) => mod.SearchFiles(voltPath, query));
}
