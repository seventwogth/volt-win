import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BUILTIN_SHORTCUT_ACTIONS,
  getPluginCommandShortcutActionId,
  useResolvedShortcuts,
} from '@entities/app-settings';
import { useFileTreeStore } from '@entities/file-tree';
import { type RegisteredSearchProvider, usePluginRegistryStore } from '@entities/plugin';
import { useTabStore } from '@entities/tab';
import { readFile, type FileEntry } from '@shared/api/file';
import { searchFiles } from '@shared/api/search';
import type { SearchResult } from '@shared/api/search';
import { getPathBasename } from '@shared/lib/fileTree';
import { getFileExtension } from '@shared/lib/fileTypes';
import { formatShortcutBinding } from '@shared/lib/hotkeys';
import { useI18n } from '@app/providers/I18nProvider';
import type { IconName } from '@shared/ui/icon';

const MAX_SEARCH_RESULTS = 50;
const MAX_CONTENT_MATCHES_PER_FILE = 5;
const SNIPPET_CONTEXT_CHARS = 50;
const EMPTY_FILE_TREE: FileEntry[] = [];

function extractSnippet(line: string, matchIdx: number, matchLength: number): string {
  const start = Math.max(matchIdx - SNIPPET_CONTEXT_CHARS, 0);
  const end = Math.min(matchIdx + matchLength + SNIPPET_CONTEXT_CHARS, line.length);

  let snippet = line.slice(start, end);
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < line.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
}

function collectFilesByExtensions(entries: FileEntry[], allowedExtensions: Set<string>): FileEntry[] {
  const files: FileEntry[] = [];

  for (const entry of entries) {
    if (entry.isDir) {
      files.push(...collectFilesByExtensions(entry.children ?? [], allowedExtensions));
      continue;
    }

    const extension = getFileExtension(entry.path);
    if (extension && allowedExtensions.has(extension)) {
      files.push(entry);
    }
  }

  return files;
}

function buildContentMatches(filePath: string, fileName: string, text: string, queryLower: string): SearchResult[] {
  const matches: SearchResult[] = [];
  const lines = text.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const matchIndex = line.toLowerCase().indexOf(queryLower);
    if (matchIndex < 0) {
      continue;
    }

    matches.push({
      filePath,
      fileName,
      snippet: extractSnippet(line, matchIndex, queryLower.length),
      line: index + 1,
      isName: false,
    });

    if (matches.length >= MAX_CONTENT_MATCHES_PER_FILE) {
      break;
    }
  }

  return matches;
}

async function searchPluginOwnedFiles(
  voltPath: string,
  tree: FileEntry[],
  queryLower: string,
  providers: RegisteredSearchProvider[],
): Promise<SearchResult[]> {
  if (providers.length === 0) {
    return [];
  }

  const providerByExtension = new Map<string, RegisteredSearchProvider>();
  for (const provider of providers) {
    for (const extension of provider.extensions) {
      if (!providerByExtension.has(extension)) {
        providerByExtension.set(extension, provider);
      }
    }
  }

  const files = collectFilesByExtensions(tree, new Set(providerByExtension.keys()));
  const nameMatches: SearchResult[] = [];
  const contentMatches: SearchResult[] = [];

  for (const entry of files) {
    if (nameMatches.length + contentMatches.length >= MAX_SEARCH_RESULTS) {
      break;
    }

    const extension = getFileExtension(entry.path);
    if (!extension) {
      continue;
    }

    const provider = providerByExtension.get(extension);
    if (!provider) {
      continue;
    }

    const fileName = getPathBasename(entry.path);
    if (fileName.toLowerCase().includes(queryLower)) {
      nameMatches.push({
        filePath: entry.path,
        fileName,
        snippet: '',
        line: 0,
        isName: true,
      });
    }

    if (nameMatches.length + contentMatches.length >= MAX_SEARCH_RESULTS) {
      break;
    }

    try {
      const content = await readFile(voltPath, entry.path);
      const extractedText = await provider.extractText({ filePath: entry.path, content });
      if (!extractedText) {
        continue;
      }

      const remaining = MAX_SEARCH_RESULTS - nameMatches.length - contentMatches.length;
      const matches = buildContentMatches(entry.path, fileName, extractedText, queryLower);
      contentMatches.push(...matches.slice(0, remaining));
    } catch (error) {
      console.error(`Failed to search plugin-owned file "${entry.path}":`, error);
    }
  }

  return [...nameMatches, ...contentMatches];
}

function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = `${result.filePath}::${result.line}::${result.isName ? 'name' : 'content'}::${result.snippet}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeSearchResults(coreResults: SearchResult[], pluginResults: SearchResult[]): SearchResult[] {
  const nameMatches = dedupeSearchResults([
    ...coreResults.filter((result) => result.isName),
    ...pluginResults.filter((result) => result.isName),
  ]);
  const contentMatches = dedupeSearchResults([
    ...coreResults.filter((result) => !result.isName),
    ...pluginResults.filter((result) => !result.isName),
  ]);

  return [...nameMatches, ...contentMatches].slice(0, MAX_SEARCH_RESULTS);
}

export interface CommandPaletteItem {
  id: string;
  title: string;
  hotkey?: string;
  icon: IconName;
  subtitle?: string;
  callback: () => void;
}

export function useSearchPopup(
  isOpen: boolean,
  onClose: () => void,
  voltId: string,
  voltPath: string,
  onToggleSidebar: () => void,
) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTab = useTabStore((state) => state.openTab);
  const startCreate = useFileTreeStore((state) => state.startCreate);
  const tree = useFileTreeStore((state) => state.trees[voltId] ?? EMPTY_FILE_TREE);
  const pluginCommands = usePluginRegistryStore((state) => state.commands);
  const pluginSearchProviders = usePluginRegistryStore((state) => state.searchProviders);
  const { byActionId } = useResolvedShortcuts();
  const isCommandMode = query.startsWith('>');
  const commandQuery = query.slice(1).trim().toLowerCase();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim() || isCommandMode) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const trimmedQuery = query.trim();
        const normalizedQuery = trimmedQuery.toLowerCase();
        const [coreResults, pluginResults] = await Promise.all([
          searchFiles(voltPath, trimmedQuery),
          searchPluginOwnedFiles(voltPath, tree, normalizedQuery, pluginSearchProviders),
        ]);
        setResults(mergeSearchResults(coreResults ?? [], pluginResults));
        setActiveIndex(0);
      } catch {
        setResults([]);
        setActiveIndex(0);
      }
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [isCommandMode, isOpen, pluginSearchProviders, query, tree, voltPath]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      openTab(voltId, result.filePath, result.fileName);
      onClose();
    },
    [openTab, onClose, voltId],
  );

  const handleCommandSelect = useCallback(
    (command: CommandPaletteItem) => {
      command.callback();
      onClose();
    },
    [onClose],
  );

  const builtInCommands = useMemo<CommandPaletteItem[]>(() => [
    {
      id: 'builtin:new-file',
      title: t('search.command.newFile'),
      hotkey: formatShortcutBinding(byActionId[BUILTIN_SHORTCUT_ACTIONS.fileCreate]?.binding),
      icon: 'plus',
      callback: () => startCreate(voltId, '', false),
    },
    {
      id: 'builtin:toggle-sidebar',
      title: t('search.command.toggleSidebar'),
      hotkey: formatShortcutBinding(byActionId[BUILTIN_SHORTCUT_ACTIONS.workspaceSidebarToggle]?.binding),
      icon: 'panelLeft',
      callback: onToggleSidebar,
    },
    {
      id: 'builtin:settings',
      title: t('search.command.settings'),
      icon: 'settings',
      callback: () => navigate('/settings'),
    },
  ], [byActionId, navigate, onToggleSidebar, startCreate, t, voltId]);

  const commandResults = useMemo<CommandPaletteItem[]>(() => {
    if (!isCommandMode) return [];

    const items = [
      ...builtInCommands,
      ...pluginCommands.map((command) => ({
        id: command.id,
        title: command.name,
        hotkey: formatShortcutBinding(byActionId[getPluginCommandShortcutActionId(command.id)]?.binding),
        icon: 'hash' as IconName,
        subtitle: command.pluginId,
        callback: command.callback,
      })),
    ];

    if (!commandQuery) return items;

    return items.filter((item) => (
      item.title.toLowerCase().includes(commandQuery) ||
      item.hotkey?.toLowerCase().includes(commandQuery) ||
      item.subtitle?.toLowerCase().includes(commandQuery)
    ));
  }, [builtInCommands, byActionId, commandQuery, isCommandMode, pluginCommands]);

  useEffect(() => {
    if (isCommandMode) {
      setActiveIndex(0);
    }
  }, [commandQuery, isCommandMode]);

  const highlightedResults = useMemo(() => {
    if (!query.trim() || isCommandMode) return [];
    return results;
  }, [isCommandMode, query, results]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const itemsCount = isCommandMode ? commandResults.length : results.length;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(itemsCount - 1, 0)));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (isCommandMode && commandResults[activeIndex]) {
          handleCommandSelect(commandResults[activeIndex]);
        } else if (!isCommandMode && results[activeIndex]) {
          handleSelect(results[activeIndex]);
        }
      }
    },
    [activeIndex, commandResults, handleCommandSelect, handleSelect, isCommandMode, onClose, results],
  );

  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const activeElement = container.children[activeIndex] as HTMLElement | undefined;
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return {
    query,
    setQuery,
    activeIndex,
    setActiveIndex,
    inputRef,
    resultsRef,
    isCommandMode,
    commandResults,
    highlightedResults,
    handleKeyDown,
    handleOverlayClick,
    handleSelect,
    handleCommandSelect,
    t,
  };
}
