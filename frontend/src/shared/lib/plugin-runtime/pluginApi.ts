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

export interface PluginFilePickerConfig {
  title?: string;
  accept?: string[];
  multiple?: boolean;
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

export type EditorEventName =
  | 'ready'
  | 'focus'
  | 'blur'
  | 'change'
  | 'save'
  | 'selection-change'
  | 'dirty-change'
  | 'dispose';

export type PluginEditorOverlayAnchor =
  | { type: 'text-range'; from: number; to: number }
  | { type: 'page-rect'; page: number; x: number; y: number; width: number; height: number; unit: 'normalized' };

export interface PluginEditorToolbarAction {
  id: string;
  label: string;
  slot?: 'primary' | 'secondary';
  commandId?: string;
  callback?: () => void | Promise<void>;
}

export interface PluginEditorCommand {
  id: string;
  execute(payload?: unknown): unknown | Promise<unknown>;
}

export interface PluginEditorPanel {
  id: string;
  slot?: 'right' | 'bottom';
  render(container: HTMLElement): void;
  cleanup?: () => void;
}

export interface PluginEditorOverlay {
  id: string;
  anchor: PluginEditorOverlayAnchor;
  render(container: HTMLElement): void;
  cleanup?: () => void;
}

export interface EditorKindInfo {
  kind: string;
  title: string;
}

export interface EditorKindCapabilities {
  kind: string;
  supportsFileTabs: boolean;
  supportsEmbeddedMount: boolean;
  supportsReadOnly: boolean;
  supportsToolbarActions: boolean;
  supportsPanels: boolean;
  supportsOverlays: boolean;
  supportedOverlayAnchors: PluginEditorOverlayAnchor['type'][];
  commandIds: string[];
  eventNames: EditorEventName[];
}

export interface EditorMountConfig {
  kind: string;
  filePath: string;
  readOnly?: boolean;
  autofocus?: boolean;
  toolbarActions?: PluginEditorToolbarAction[];
  commands?: PluginEditorCommand[];
  panels?: PluginEditorPanel[];
  overlays?: PluginEditorOverlay[];
}

export interface EditorHandle {
  id: string;
  kind: string;
  filePath: string;
  focus(): void;
  save(): Promise<void>;
  dispose(): void;
  isDirty(): boolean;
  execute(commandId: string, payload?: unknown): Promise<unknown>;
  on(eventName: EditorEventName, callback: (payload: unknown) => void | Promise<void>): () => void;
}

export interface PluginCustomFileViewerConfig {
  id: string;
  extensions: string[];
  icon?: string;
  priority?: number;
  render: (container: HTMLElement, context: PluginFileViewerContext) => void;
  cleanup?: () => void;
}

export interface PluginHostEditorFileViewerConfig {
  id: string;
  extensions: string[];
  icon?: string;
  priority?: number;
  hostEditor: Omit<EditorMountConfig, 'filePath'>;
}

export type PluginFileViewerConfig =
  | PluginCustomFileViewerConfig
  | PluginHostEditorFileViewerConfig;

export interface VoltPluginAPI {
  fs: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    create(path: string, content?: string): Promise<void>;
    list(dirPath?: string): Promise<FileEntry[]>;
  };
  workspace: {
    getActivePath(): string | null;
    getRootPath(): string;
  };
  search: {
    registerTextProvider(config: SearchFileTextProvider): void;
  };
  assets: {
    pickImage(): Promise<string>;
    pickFile(config?: PluginFilePickerConfig): Promise<string | string[] | null>;
    copyAsset(sourcePath: string, targetDir?: string): Promise<string>;
    copyImage(sourcePath: string, targetDir?: string): Promise<string>;
    saveImageBase64(fileName: string, base64: string, targetDir?: string): Promise<string>;
    readImageDataUrl(path: string): Promise<string>;
  };
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
    registerPage(config: {
      id: string;
      title: string;
      mode: 'tab' | 'route';
      render: (container: HTMLElement) => void;
      cleanup?: () => void;
    }): void;
    registerFileViewer(config: PluginFileViewerConfig): void;
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
    openExternalUrl(url: string): void;
    notify(message: string, durationMs?: number): void;
  };
  editor: {
    captureActiveSession(): Promise<EditorSession | null>;
    openSession(path: string): Promise<EditorSession>;
    listKinds(): EditorKindInfo[];
    getCapabilities(kind: string): EditorKindCapabilities;
    mount(container: HTMLElement, config: EditorMountConfig): Promise<EditorHandle>;
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
