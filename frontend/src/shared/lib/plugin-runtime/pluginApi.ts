import type { FileEntry } from '@shared/api/file';
import type { PluginSettingsSection } from '@shared/api/plugin';

export interface EditorSessionRange {
  from: number;
  to: number;
}

export interface PluginSettingChangeEvent {
  key: string;
  value: unknown;
  values: Record<string, unknown>;
}

export interface WorkspacePathRenamedEvent {
  oldPath: string;
  newPath: string;
  isDir: boolean;
}

export interface SearchFileTextProviderInput {
  filePath: string;
  content: string;
}

export interface SearchFileTextProvider {
  id: string;
  extensions: string[];
  extractText(input: SearchFileTextProviderInput): string | null | undefined | Promise<string | null | undefined>;
}

export interface PluginEventMap {
  'workspace:path-renamed': WorkspacePathRenamedEvent;
  'file-open': string;
  'file-save': string;
  'editor-change': undefined;
}

export interface EditorSession {
  id: string;
  filePath: string;
  getMarkdown(): string;
  save(): Promise<void>;
  dispose(): void;
  onDidChange(callback: () => void | Promise<void>): () => void;
  getSelection(): EditorSessionRange;
  createAnchor(options?: {
    from?: number;
    to?: number;
    bias?: 'start' | 'end';
  }): string;
  getAnchorRange(anchorId: string): EditorSessionRange | null;
  insertAtAnchor(anchorId: string, text: string): void;
  replaceRange(range: EditorSessionRange, text: string): void;
  removeAnchor(anchorId: string): void;
}

export type DesktopProcessEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string };

export interface DesktopProcessHandle {
  id: string;
  onEvent(callback: (event: DesktopProcessEvent) => void | Promise<void>): () => void;
  cancel(): Promise<void>;
}

export interface PluginTaskStatusHandle {
  setMessage(message: string): void;
  markSuccess(message?: string): void;
  markError(message: string): void;
  markCancelled(message?: string): void;
  close(): void;
}

export interface PluginFileViewerContext {
  voltId: string;
  voltPath: string;
  filePath: string;
  fileName: string;
  setDirty(dirty: boolean): void;
  registerSaveHandler(handler: () => Promise<void>): () => void;
}

export interface VoltPluginAPI {
  volt: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    createFile(path: string, content?: string): Promise<void>;
    list(dirPath?: string): Promise<FileEntry[]>;
    getActivePath(): string | null;
  };
  search: {
    registerFileTextProvider(config: SearchFileTextProvider): void;
  };
  media: {
    pickImage(): Promise<string>;
    copyImage(sourcePath: string, targetDir?: string): Promise<string>;
    saveImageBase64(fileName: string, base64: string, targetDir?: string): Promise<string>;
    readImageDataUrl(path: string): Promise<string>;
  };
  desktop: {
    process: {
      start(config: {
        command: string;
        args?: string[];
        stdin?: string;
        cwd: 'workspace';
        stdoutMode?: 'raw' | 'lines';
        stderrMode?: 'raw' | 'lines';
      }): Promise<DesktopProcessHandle>;
    };
  };
  ui: {
    promptText(config: {
      title: string;
      description?: string;
      placeholder?: string;
      submitLabel?: string;
      initialValue?: string;
      multiline?: boolean;
    }): Promise<string | null>;
    createTaskStatus(config: {
      title: string;
      message?: string;
      cancellable?: boolean;
      onCancel?: () => void | Promise<void>;
      surface?: 'floating' | 'workspace-banner';
      sessionId?: string;
      scope?: 'workspace' | 'source-note';
    }): PluginTaskStatusHandle;
    registerSidebarPanel(config: {
      id: string;
      title: string;
      render: (container: HTMLElement) => void;
    }): void;
    registerCommand(config: {
      id: string;
      name: string;
      hotkey?: string;
      callback: () => void | Promise<void>;
    }): void;
    registerPluginPage(config: {
      id: string;
      title: string;
      mode: 'tab' | 'route';
      render: (container: HTMLElement) => void;
      cleanup?: () => void;
    }): void;
    registerFileViewer(config: {
      id: string;
      extensions: string[];
      icon?: string;
      render: (container: HTMLElement, context: PluginFileViewerContext) => void;
      cleanup?: () => void;
    }): void;
    registerSlashCommand(config: {
      id: string;
      title: string;
      description: string;
      icon: string;
      callback: () => void | Promise<void>;
    }): void;
    registerContextMenuItem(config: {
      id: string;
      label: string;
      icon?: string;
      filter?: (entry: { path: string; isDir: boolean }) => boolean;
      callback: (entry: { path: string; isDir: boolean }) => void | Promise<void>;
    }): void;
    registerToolbarButton(config: {
      id: string;
      label: string;
      icon: string;
      callback: () => void | Promise<void>;
    }): void;
    registerSidebarButton(config: {
      id: string;
      label: string;
      icon: string;
      callback: () => void | Promise<void>;
    }): void;
    openPluginPage(pageId: string): void;
    openFile(path: string): void;
    showNotice(message: string, durationMs?: number): void;
  };
  editor: {
    captureActiveSession(): Promise<EditorSession | null>;
    openSession(path: string): Promise<EditorSession>;
  };
  events: {
    on<TEvent extends keyof PluginEventMap>(
      event: TEvent,
      callback: (payload: PluginEventMap[TEvent]) => void | Promise<void>,
    ): () => void;
  };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  settings: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    getAll(): Promise<Record<string, unknown>>;
    set(key: string, value: unknown): Promise<void>;
    onChange(callback: (event: PluginSettingChangeEvent) => void | Promise<void>): () => void;
  };
}

export type { PluginSettingsSection };
