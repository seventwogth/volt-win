import type {
  DesktopProcessEvent,
  DesktopProcessHandle,
  EditorSession,
  PluginEventMap,
  PluginIcon,
  PluginSettingsSection,
  SearchFileTextProviderInput,
  VoltPluginAPI,
} from './pluginApi';
import {
  registerCommand,
  registerContextMenuItem,
  registerFileViewer,
  registerPluginPage,
  registerSearchProvider,
  registerSidebarButton,
  registerSidebarPanel,
  registerSlashCommand,
  registerToolbarButton,
  usePluginLogStore,
  usePluginRegistryStore,
} from '@entities/plugin';
import { onTracked } from './pluginEventBus';
import { createFile as createWorkspaceFile, listTree, readFile, type FileEntry, writeFile } from '@shared/api/file';
import { copyImage, pickImage, readImageBase64, saveImageBase64 } from '@shared/api/image/imageApi';
import { copyPluginAsset, getPluginData, pickPluginFiles, setPluginData } from '@shared/api/plugin';
import { openPluginPrompt } from '@features/plugin-prompt';
import { useWorkspaceStore } from '@entities/workspace';
import { useFileTreeStore } from '@entities/file-tree';
import { useTabStore } from '@entities/tab';
import { useToastStore } from '@shared/ui/toast';
import { isIconName } from '@shared/ui/icon/icons';
import type { IconSource } from '@shared/ui/icon';
import {
  captureActiveEditorSession,
  openEditorSession,
  type PluginEditorSession,
} from './editorSessionManager';
import {
  getAvailableHostEditorCapabilities,
  listAvailableHostEditorKinds,
  mountPluginHostEditor,
} from './hostEditorService';
import {
  startPluginProcess,
  type PluginProcessHandle,
} from './pluginProcessManager';
import {
  createPluginTaskStatus,
  type PluginTaskStatusHandle,
} from '@features/plugin-task-status';
import { reportPluginError, safeExecute, safeExecuteMaybeAsync } from './safeExecute';
import {
  getAllPluginSettings,
  getPluginSettingValue,
  setPluginSettingValue,
  subscribePluginSettings,
} from '@entities/plugin';
import { normalizeWorkspacePath } from '@shared/lib/workspacePath';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';

function normalizePluginIcon(icon?: PluginIcon): IconSource {
  if (typeof icon === 'string' && isIconName(icon)) {
    return icon;
  }

  if (icon && typeof icon === 'object' && typeof icon.svg === 'string' && icon.svg.trim()) {
    return { svg: icon.svg.trim() };
  }

  return 'file';
}

function normalizeExtensions(extensions: string[]): string[] {
  return extensions.map((extension) => extension.trim().toLowerCase()).filter(Boolean);
}

export function createPluginAPI(
  pluginId: string,
  voltPath: string,
  permissions: string[],
  settingsSections: PluginSettingsSection[] = [],
): VoltPluginAPI {
  const declaredPermissions = new Set(permissions);

  const namespaceId = (configId: string) => `${pluginId}:${configId}`;
  const notifyFsMutation = async (): Promise<void> => {
    const voltId = useWorkspaceStore.getState().activeWorkspaceId;
    if (!voltId) {
      return;
    }

    await useFileTreeStore.getState().notifyFsMutation(voltId, voltPath);
  };

  const requirePermission = (permission: 'read' | 'write' | 'editor' | 'process' | 'external', action: string) => {
    if (declaredPermissions.has(permission)) {
      return;
    }

    throw reportPluginError(
      pluginId,
      action,
      new Error(`Permission "${permission}" is required for ${action}`),
    );
  };

  const wrapCallback = <TArgs extends unknown[]>(
    label: string,
    callback: (...args: TArgs) => void | Promise<void>,
  ) => (...args: TArgs): void => {
    safeExecuteMaybeAsync(pluginId, label, () => callback(...args));
  };

  const wrapFilter = <TArg,>(
    label: string,
    filter?: (arg: TArg) => boolean,
  ) => {
    if (!filter) {
      return undefined;
    }

    return (arg: TArg): boolean => {
      try {
        return filter(arg);
      } catch (err) {
        reportPluginError(pluginId, label, err);
        return false;
      }
    };
  };

  const wrapSession = (session: PluginEditorSession): EditorSession => ({
    id: session.id,
    filePath: session.filePath,
    getMarkdown: () => session.getMarkdown(),
    save: () => session.save(),
    dispose: () => session.dispose(),
    onDidChange: (callback: () => void | Promise<void>) => session.onDidChange(() => {
      safeExecuteMaybeAsync(pluginId, `editorSession:${session.id}:change`, () => callback());
    }),
    getSelection: () => session.getSelection(),
    createAnchor: (options) => session.createAnchor(options),
    getAnchorRange: (anchorId) => session.getAnchorRange(anchorId),
    insertAtAnchor: (anchorId, text) => session.insertAtAnchor(anchorId, text),
    replaceRange: (range, text) => session.replaceRange(range, text),
    removeAnchor: (anchorId) => session.removeAnchor(anchorId),
  });

  const wrapProcessHandle = (
    handle: PluginProcessHandle,
  ): DesktopProcessHandle => ({
    id: handle.id,
    onEvent(callback: (event: DesktopProcessEvent) => void | Promise<void>) {
      return handle.onEvent((event) => {
        safeExecuteMaybeAsync(pluginId, `process:${handle.id}:event`, () => callback(event));
      });
    },
    cancel: () => handle.cancel(),
  });

  const wrapTaskStatusHandle = (
    handle: PluginTaskStatusHandle,
  ): PluginTaskStatusHandle => ({
    setMessage: (message) => handle.setMessage(message),
    markSuccess: (message) => handle.markSuccess(message),
    markError: (message) => handle.markError(message),
    markCancelled: (message) => handle.markCancelled(message),
    close: () => handle.close(),
  });

  const wrapSearchProvider = (
    providerId: string,
    extractText: (input: SearchFileTextProviderInput) => string | null | undefined | Promise<string | null | undefined>,
  ) => async (input: SearchFileTextProviderInput): Promise<string> => {
    try {
      const value = await extractText(input);
      return typeof value === 'string' ? value : '';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Plugin ${pluginId}] searchProvider:${providerId}:extractText:`, err);
      usePluginLogStore.getState().addEntry(pluginId, 'error', `searchProvider:${providerId}:extractText: ${message}`);
      return '';
    }
  };

  const wrapAsyncResult = <TArgs extends unknown[]>(
    label: string,
    callback: (...args: TArgs) => unknown | Promise<unknown>,
  ) => async (...args: TArgs): Promise<unknown> => {
    try {
      return await callback(...args);
    } catch (err) {
      throw reportPluginError(pluginId, label, err);
    }
  };

  const normalizeHostEditorConfig = <TConfig extends {
    kind: string;
    readOnly?: boolean;
    autofocus?: boolean;
    toolbarActions?: Array<{
      id: string;
      label: string;
      slot?: 'primary' | 'secondary';
      commandId?: string;
      callback?: () => void | Promise<void>;
    }>;
    commands?: Array<{
      id: string;
      execute(payload?: unknown): unknown | Promise<unknown>;
    }>;
    panels?: Array<{
      id: string;
      slot?: 'right' | 'bottom';
      render(container: HTMLElement): void;
      cleanup?: () => void;
    }>;
    overlays?: Array<{
      id: string;
      anchor: {
        type: 'text-range' | 'page-rect';
      };
      render(container: HTMLElement): void;
      cleanup?: () => void;
    }>;
  }>(
    labelPrefix: string,
    config: TConfig,
  ): TConfig => ({
    ...config,
    toolbarActions: config.toolbarActions?.map((action) => ({
      ...action,
      callback: action.callback ? wrapCallback(`${labelPrefix}:toolbar:${action.id}`, action.callback) : undefined,
    })),
    commands: config.commands?.map((command) => ({
      ...command,
      execute: wrapAsyncResult(`${labelPrefix}:command:${command.id}`, command.execute),
    })),
    panels: config.panels?.map((panel) => ({
      ...panel,
      render: (container: HTMLElement) => {
        safeExecute(pluginId, `${labelPrefix}:panel:${panel.id}:render`, () => {
          panel.render(container);
        });
      },
      cleanup: panel.cleanup
        ? () => {
          safeExecute(pluginId, `${labelPrefix}:panel:${panel.id}:cleanup`, () => {
            panel.cleanup!();
          });
        }
        : undefined,
    })),
    overlays: config.overlays?.map((overlay) => ({
      ...overlay,
      render: (container: HTMLElement) => {
        safeExecute(pluginId, `${labelPrefix}:overlay:${overlay.id}:render`, () => {
          overlay.render(container);
        });
      },
      cleanup: overlay.cleanup
        ? () => {
          safeExecute(pluginId, `${labelPrefix}:overlay:${overlay.id}:cleanup`, () => {
            overlay.cleanup!();
          });
        }
        : undefined,
    })),
  });

  return {
    fs: {
      async read(path: string): Promise<string> {
        requirePermission('read', 'fs.read');
        return readFile(voltPath, normalizeWorkspacePath(path));
      },
      async write(path: string, content: string): Promise<void> {
        requirePermission('write', 'fs.write');
        return writeFile(voltPath, normalizeWorkspacePath(path), content);
      },
      async create(path: string, content = ''): Promise<void> {
        requirePermission('write', 'fs.create');

        const normalizedPath = normalizeWorkspacePath(path);
        if (!normalizedPath) {
          throw reportPluginError(pluginId, 'fs.create', new Error('File path is required'));
        }

        await createWorkspaceFile(voltPath, normalizedPath, content);
        await notifyFsMutation();
      },
      async list(dirPath?: string): Promise<FileEntry[]> {
        requirePermission('read', 'fs.list');
        return listTree(voltPath, dirPath ?? '');
      },
    },
    workspace: {
      getActivePath(): string | null {
        requirePermission('read', 'workspace.getActivePath');
        const voltId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!voltId) return null;
        const tabState = useTabStore.getState();
        const activeTabId = tabState.activeTabs[voltId] ?? null;
        if (!activeTabId) return null;
        const tabs = tabState.tabs[voltId] ?? [];
        const tab = tabs.find((t) => t.id === activeTabId);
        return tab && tab.type === 'file' ? tab.filePath : null;
      },
      getRootPath(): string {
        requirePermission('read', 'workspace.getRootPath');
        return voltPath;
      },
    },
    search: {
      registerTextProvider(config) {
        requirePermission('read', 'search.registerTextProvider');
        registerSearchProvider({
          id: namespaceId(config.id),
          pluginId,
          extensions: normalizeExtensions(config.extensions),
          extractText: wrapSearchProvider(config.id, config.extractText),
        });
      },
    },
    assets: {
      pickImage() {
        return pickImage();
      },
      async pickFile(config) {
        requirePermission('external', 'assets.pickFile');
        const paths = await pickPluginFiles(
          config?.title ?? '',
          config?.accept ?? [],
          Boolean(config?.multiple),
        );

        if (config?.multiple) {
          return paths;
        }

        return paths[0] ?? null;
      },
      async copyAsset(sourcePath: string, targetDir?: string) {
        requirePermission('write', 'assets.copyAsset');
        const path = await copyPluginAsset(voltPath, sourcePath, targetDir ?? '');
        await notifyFsMutation();
        return path;
      },
      async copyImage(sourcePath: string, targetDir?: string) {
        requirePermission('write', 'assets.copyImage');
        const path = await copyImage(voltPath, sourcePath, targetDir ?? '');
        await notifyFsMutation();
        return path;
      },
      async saveImageBase64(fileName: string, base64: string, targetDir?: string) {
        requirePermission('write', 'assets.saveImageBase64');
        const path = await saveImageBase64(voltPath, fileName, targetDir ?? '', base64);
        await notifyFsMutation();
        return path;
      },
      async readImageDataUrl(path: string) {
        requirePermission('read', 'assets.readImageDataUrl');
        return readImageBase64(voltPath, normalizeWorkspacePath(path));
      },
    },
    process: {
      async start(config) {
        requirePermission('process', 'process.start');
        if (config.cwd !== 'workspace') {
          throw reportPluginError(
            pluginId,
            'process.start',
            new Error('Only cwd="workspace" is supported'),
          );
        }

        const handle = await startPluginProcess(pluginId, voltPath, config);
        return wrapProcessHandle(handle);
      },
    },
    ui: {
      promptText(config) {
        return openPluginPrompt(config);
      },
      createTaskStatus(config) {
        const onCancel = config.onCancel
          ? () => {
            safeExecuteMaybeAsync(pluginId, `taskStatusCancel:${config.title}`, () => config.onCancel!());
          }
          : undefined;

        const handle = createPluginTaskStatus(pluginId, {
          title: config.title,
          message: config.message,
          cancellable: config.cancellable,
          onCancel,
          surface: config.surface,
          sessionId: config.sessionId,
          scope: config.scope,
        });

        return wrapTaskStatusHandle(handle);
      },
      registerSidebarPanel(config) {
        registerSidebarPanel({
          id: namespaceId(config.id),
          pluginId,
          title: config.title,
          render: config.render,
        });
      },
      registerCommand(config) {
        registerCommand({
          id: namespaceId(config.id),
          pluginId,
          name: config.name,
          icon: config.icon ? normalizePluginIcon(config.icon) : undefined,
          hotkey: config.hotkey,
          callback: wrapCallback(`command:${config.id}`, config.callback),
        });
      },
      registerPage(config) {
        registerPluginPage({
          id: namespaceId(config.id),
          pluginId,
          title: config.title,
          mode: config.mode,
          render: config.render,
          cleanup: config.cleanup,
        });
      },
      registerFileViewer(config) {
        const normalizedBase = {
          id: namespaceId(config.id),
          pluginId,
          extensions: config.extensions.map((extension) => extension.trim().toLowerCase()).filter(Boolean),
          icon: config.icon ? normalizePluginIcon(config.icon) : undefined,
          priority: config.priority ?? 0,
        };

        if ('hostEditor' in config) {
          registerFileViewer({
            ...normalizedBase,
            hostEditor: normalizeHostEditorConfig(`fileViewer:${config.id}:hostEditor`, config.hostEditor),
          });
          return;
        }

        registerFileViewer({
          ...normalizedBase,
          render: (container, context) => {
            safeExecute(pluginId, `fileViewer:${config.id}:render`, () => {
              config.render(container, context);
            });
          },
          cleanup: config.cleanup
            ? () => {
              safeExecute(pluginId, `fileViewer:${config.id}:cleanup`, () => {
                config.cleanup!();
              });
            }
            : undefined,
        });
      },
      registerSlashCommand(config) {
        registerSlashCommand({
          id: namespaceId(config.id),
          pluginId,
          title: config.title,
          description: config.description,
          icon: normalizePluginIcon(config.icon),
          callback: wrapCallback(`slash:${config.id}`, config.callback),
        });
      },
      registerContextMenuItem(config) {
        registerContextMenuItem({
          id: namespaceId(config.id),
          pluginId,
          label: config.label,
          icon: config.icon ? normalizePluginIcon(config.icon) : undefined,
          filter: wrapFilter(`contextMenuFilter:${config.id}`, config.filter),
          callback: wrapCallback(`contextMenu:${config.id}`, config.callback),
        });
      },
      registerToolbarButton(config) {
        registerToolbarButton({
          id: namespaceId(config.id),
          pluginId,
          label: config.label,
          icon: normalizePluginIcon(config.icon),
          callback: wrapCallback(`toolbar:${config.id}`, config.callback),
        });
      },
      registerSidebarButton(config) {
        registerSidebarButton({
          id: namespaceId(config.id),
          pluginId,
          label: config.label,
          icon: normalizePluginIcon(config.icon),
          callback: wrapCallback(`sidebarButton:${config.id}`, config.callback),
        });
      },
      openPluginPage(pageId: string) {
        const voltId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!voltId) {
          throw reportPluginError(pluginId, `openPluginPage:${pageId}`, new Error('No active workspace'));
        }

        const fullPageId = namespaceId(pageId);
        const page = usePluginRegistryStore.getState().pluginPages.find((entry) => entry.id === fullPageId);
        if (!page) {
          throw reportPluginError(
            pluginId,
            `openPluginPage:${pageId}`,
            new Error(`Plugin page "${fullPageId}" is not registered`),
          );
        }

        if (page.mode === 'tab') {
          useTabStore.getState().openPluginTab(voltId, page.id, page.title);
          return;
        }

        window.dispatchEvent(new CustomEvent('volt:navigate-plugin-page', {
          detail: { voltId, pageId: page.id },
        }));
      },
      openFile(path: string) {
        const voltId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!voltId) {
          throw reportPluginError(pluginId, `openFile:${path}`, new Error('No active workspace'));
        }

        const normalizedPath = normalizeWorkspacePath(path);
        if (!normalizedPath) {
          throw reportPluginError(pluginId, 'openFile', new Error('File path is required'));
        }

        useTabStore.getState().openTab(voltId, normalizedPath, normalizedPath);
      },
      openExternalUrl(url: string) {
        requirePermission('external', 'ui.openExternalUrl');
        const normalizedUrl = url.trim();
        if (!normalizedUrl) {
          throw reportPluginError(pluginId, 'ui.openExternalUrl', new Error('URL is required'));
        }

        BrowserOpenURL(normalizedUrl);
      },
      notify(message: string, durationMs?: number) {
        useToastStore.getState().addToast(message, 'info', durationMs ?? 4000);
      },
    },
    editor: {
      async captureActiveSession() {
        requirePermission('editor', 'editor.captureActiveSession');
        const session = await captureActiveEditorSession(pluginId, voltPath);
        return session ? wrapSession(session) : null;
      },
      async openSession(path: string) {
        requirePermission('editor', 'editor.openSession');
        const session = await openEditorSession(pluginId, voltPath, normalizeWorkspacePath(path));
        return wrapSession(session);
      },
      listKinds() {
        requirePermission('editor', 'editor.listKinds');
        return listAvailableHostEditorKinds();
      },
      getCapabilities(kind: string) {
        requirePermission('editor', 'editor.getCapabilities');
        const capabilities = getAvailableHostEditorCapabilities(kind);
        if (!capabilities) {
          throw reportPluginError(pluginId, `editor.getCapabilities:${kind}`, new Error(`Host editor kind "${kind}" is not available`));
        }
        return capabilities;
      },
      async mount(container: HTMLElement, config) {
        requirePermission('editor', 'editor.mount');
        if (!container) {
          throw reportPluginError(pluginId, 'editor.mount', new Error('A valid container element is required'));
        }
        return mountPluginHostEditor(
          pluginId,
          voltPath,
          container,
          normalizeHostEditorConfig('editor.mount', config),
        );
      },
    },
    events: {
      on<TEvent extends keyof PluginEventMap>(
        event: TEvent,
        callback: (payload: PluginEventMap[TEvent]) => void | Promise<void>,
      ): () => void {
        return onTracked(pluginId, event, wrapCallback(`event:${event}`, callback));
      },
    },
    storage: {
      async get(key: string): Promise<unknown> {
        const raw = await getPluginData(pluginId, key);
        if (!raw) return undefined;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      async set(key: string, value: unknown): Promise<void> {
        await setPluginData(pluginId, key, JSON.stringify(value));
      },
    },
    settings: {
      get<T = unknown>(key: string) {
        return getPluginSettingValue<T>(pluginId, key, settingsSections);
      },
      getAll() {
        return getAllPluginSettings(pluginId, settingsSections);
      },
      set(key: string, value: unknown) {
        return setPluginSettingValue(pluginId, key, value, settingsSections).then(() => undefined);
      },
      onChange(callback) {
        return subscribePluginSettings(pluginId, callback);
      },
    },
  };
}
