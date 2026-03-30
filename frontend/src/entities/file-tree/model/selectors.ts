import type { FileEntry } from '@shared/api/file/types';

/**
 * Memoized selector factories for fileTreeStore.
 * Each factory returns a stable selector function for a given voltId,
 * preventing inline closures that cause Zustand to re-subscribe on every render.
 */

// Use a generic state shape to avoid circular import with fileTreeStore
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStoreState = any;
type SelectorFn<T> = (state: AnyStoreState) => T;

const EMPTY_TREE: FileEntry[] = [];
const EMPTY_PATHS: readonly string[] = [];

const selectorCache = new Map<string, Map<string, SelectorFn<unknown>>>();

function getCachedSelector<T>(
  category: string,
  voltId: string,
  factory: () => SelectorFn<T>,
): SelectorFn<T> {
  let categoryMap = selectorCache.get(category);
  if (!categoryMap) {
    categoryMap = new Map();
    selectorCache.set(category, categoryMap);
  }

  let selector = categoryMap.get(voltId);
  if (!selector) {
    selector = factory() as SelectorFn<unknown>;
    categoryMap.set(voltId, selector);
  }

  return selector as SelectorFn<T>;
}

export function selectTree(voltId: string) {
  return getCachedSelector<FileEntry[]>('tree', voltId, () =>
    (state) => state.trees[voltId] ?? EMPTY_TREE,
  );
}

export function selectLoading(voltId: string) {
  return getCachedSelector<boolean>('loading', voltId, () =>
    (state) => state.loading[voltId] ?? false,
  );
}

export function selectError(voltId: string) {
  return getCachedSelector<string | null>('error', voltId, () =>
    (state) => state.error[voltId] ?? null,
  );
}

export function selectExpandedPaths(voltId: string) {
  return getCachedSelector<readonly string[]>('expandedPaths', voltId, () =>
    (state) => state.expandedPaths[voltId] ?? EMPTY_PATHS,
  );
}

export function selectSelectedPath(voltId: string) {
  return getCachedSelector<string | null>('selectedPath', voltId, () =>
    (state) => state.selectedPath[voltId] ?? null,
  );
}

export function selectPendingCreate(voltId: string) {
  return getCachedSelector('pendingCreate', voltId, () =>
    (state) => state.pendingCreate[voltId] ?? null,
  );
}

export function selectPendingDelete(voltId: string) {
  return getCachedSelector('pendingDelete', voltId, () =>
    (state) => state.pendingDelete[voltId] ?? null,
  );
}

export function selectDraggingPath(voltId: string) {
  return getCachedSelector<string | null>('draggingPath', voltId, () =>
    (state) => state.draggingPath[voltId] ?? null,
  );
}

export function selectDropTargetPath(voltId: string) {
  return getCachedSelector<string | null>('dropTargetPath', voltId, () =>
    (state) => state.dropTargetPath[voltId] ?? null,
  );
}

export function selectDropTargetParentPath(voltId: string) {
  return getCachedSelector<string | null>('dropTargetParentPath', voltId, () =>
    (state) => state.dropTargetParentPath[voltId] ?? null,
  );
}

export function selectDropPosition(voltId: string) {
  return getCachedSelector<string | null>('dropPosition', voltId, () =>
    (state) => state.dropPosition[voltId] ?? null,
  );
}
