import { create } from 'zustand';
import type { IconName } from '@shared/ui/icon';
import type {
  PluginFileViewerContext,
  SearchFileTextProviderInput,
} from '@shared/lib/plugin-runtime';
import { reportPluginError } from '@shared/lib/plugin-runtime';

export interface RegisteredCommand {
  id: string;
  pluginId: string;
  name: string;
  hotkey?: string;
  callback: () => void;
}

export interface RegisteredSidebarPanel {
  id: string;
  pluginId: string;
  title: string;
  render: (container: HTMLElement) => void;
}

export interface RegisteredPluginPage {
  id: string;
  pluginId: string;
  title: string;
  mode: 'tab' | 'route';
  render: (container: HTMLElement) => void;
  cleanup?: () => void;
}

export interface RegisteredFileViewer {
  id: string;
  pluginId: string;
  extensions: string[];
  icon?: IconName;
  render: (container: HTMLElement, context: PluginFileViewerContext) => void;
  cleanup?: () => void;
}

export interface RegisteredSearchProvider {
  id: string;
  pluginId: string;
  extensions: string[];
  extractText: (input: SearchFileTextProviderInput) => Promise<string>;
}

export interface RegisteredSlashCommand {
  id: string;
  pluginId: string;
  title: string;
  description: string;
  icon: IconName;
  callback: () => void;
}

export interface PluginContextMenuEntry {
  path: string;
  isDir: boolean;
}

export interface RegisteredContextMenuItem {
  id: string;
  pluginId: string;
  label: string;
  icon?: IconName;
  filter?: (entry: PluginContextMenuEntry) => boolean;
  callback: (entry: PluginContextMenuEntry) => void;
}

export interface RegisteredToolbarButton {
  id: string;
  pluginId: string;
  label: string;
  icon: IconName;
  callback: () => void;
}

export interface RegisteredSidebarButton {
  id: string;
  pluginId: string;
  label: string;
  icon: IconName;
  callback: () => void;
}

interface PluginRegistryState {
  commands: RegisteredCommand[];
  sidebarPanels: RegisteredSidebarPanel[];
  pluginPages: RegisteredPluginPage[];
  fileViewers: RegisteredFileViewer[];
  searchProviders: RegisteredSearchProvider[];
  slashCommands: RegisteredSlashCommand[];
  contextMenuItems: RegisteredContextMenuItem[];
  toolbarButtons: RegisteredToolbarButton[];
  sidebarButtons: RegisteredSidebarButton[];
  registerCommand: (cmd: RegisteredCommand) => void;
  registerSidebarPanel: (panel: RegisteredSidebarPanel) => void;
  registerPluginPage: (page: RegisteredPluginPage) => void;
  registerFileViewer: (viewer: RegisteredFileViewer) => void;
  registerSearchProvider: (provider: RegisteredSearchProvider) => void;
  registerSlashCommand: (command: RegisteredSlashCommand) => void;
  registerContextMenuItem: (item: RegisteredContextMenuItem) => void;
  registerToolbarButton: (button: RegisteredToolbarButton) => void;
  registerSidebarButton: (button: RegisteredSidebarButton) => void;
  removeByPluginId: (pluginId: string) => void;
  clearAll: () => void;
}

const pageCleanupState = new Map<string, boolean>();

function runPageCleanup(page: RegisteredPluginPage, force = false): void {
  if (!page.cleanup || (!force && !pageCleanupState.get(page.id))) {
    return;
  }

  pageCleanupState.set(page.id, false);
  try {
    page.cleanup();
  } catch (err) {
    reportPluginError(page.pluginId, `page:${page.id}:cleanup`, err);
  }
}

export const usePluginRegistryStore = create<PluginRegistryState>((set) => ({
  commands: [],
  sidebarPanels: [],
  pluginPages: [],
  fileViewers: [],
  searchProviders: [],
  slashCommands: [],
  contextMenuItems: [],
  toolbarButtons: [],
  sidebarButtons: [],
  registerCommand: (cmd) => set((s) => ({ commands: [...s.commands, cmd] })),
  registerSidebarPanel: (panel) => set((s) => ({ sidebarPanels: [...s.sidebarPanels, panel] })),
  registerPluginPage: (page) => set((s) => ({ pluginPages: [...s.pluginPages, page] })),
  registerFileViewer: (viewer) => set((s) => ({ fileViewers: [...s.fileViewers, viewer] })),
  registerSearchProvider: (provider) => set((s) => ({ searchProviders: [...s.searchProviders, provider] })),
  registerSlashCommand: (command) => set((s) => ({ slashCommands: [...s.slashCommands, command] })),
  registerContextMenuItem: (item) => set((s) => ({ contextMenuItems: [...s.contextMenuItems, item] })),
  registerToolbarButton: (button) => set((s) => ({ toolbarButtons: [...s.toolbarButtons, button] })),
  registerSidebarButton: (button) => set((s) => ({ sidebarButtons: [...s.sidebarButtons, button] })),
  removeByPluginId: (pluginId) => set((s) => {
    const removedPages = s.pluginPages.filter((page) => page.pluginId === pluginId);
    removedPages.forEach((page) => runPageCleanup(page, true));
    removedPages.forEach((page) => pageCleanupState.delete(page.id));
    return {
      commands: s.commands.filter((cmd) => cmd.pluginId !== pluginId),
      sidebarPanels: s.sidebarPanels.filter((panel) => panel.pluginId !== pluginId),
      pluginPages: s.pluginPages.filter((page) => page.pluginId !== pluginId),
      fileViewers: s.fileViewers.filter((viewer) => viewer.pluginId !== pluginId),
      searchProviders: s.searchProviders.filter((provider) => provider.pluginId !== pluginId),
      slashCommands: s.slashCommands.filter((cmd) => cmd.pluginId !== pluginId),
      contextMenuItems: s.contextMenuItems.filter((item) => item.pluginId !== pluginId),
      toolbarButtons: s.toolbarButtons.filter((button) => button.pluginId !== pluginId),
      sidebarButtons: s.sidebarButtons.filter((button) => button.pluginId !== pluginId),
    };
  }),
  clearAll: () => set((s) => {
    s.pluginPages.forEach((page) => runPageCleanup(page, true));
    pageCleanupState.clear();
    return {
      commands: [],
      sidebarPanels: [],
      pluginPages: [],
      fileViewers: [],
      searchProviders: [],
      slashCommands: [],
      contextMenuItems: [],
      toolbarButtons: [],
      sidebarButtons: [],
    };
  }),
}));

export function registerCommand(cmd: RegisteredCommand): void {
  usePluginRegistryStore.getState().registerCommand(cmd);
}

export function registerSidebarPanel(panel: RegisteredSidebarPanel): void {
  usePluginRegistryStore.getState().registerSidebarPanel(panel);
}

export function registerPluginPage(page: RegisteredPluginPage): void {
  usePluginRegistryStore.getState().registerPluginPage(page);
}

export function registerFileViewer(viewer: RegisteredFileViewer): void {
  usePluginRegistryStore.getState().registerFileViewer(viewer);
}

export function registerSearchProvider(provider: RegisteredSearchProvider): void {
  usePluginRegistryStore.getState().registerSearchProvider(provider);
}

export function registerSlashCommand(command: RegisteredSlashCommand): void {
  usePluginRegistryStore.getState().registerSlashCommand(command);
}

export function registerContextMenuItem(item: RegisteredContextMenuItem): void {
  usePluginRegistryStore.getState().registerContextMenuItem(item);
}

export function registerToolbarButton(button: RegisteredToolbarButton): void {
  usePluginRegistryStore.getState().registerToolbarButton(button);
}

export function registerSidebarButton(button: RegisteredSidebarButton): void {
  usePluginRegistryStore.getState().registerSidebarButton(button);
}

export function getCommands(): RegisteredCommand[] {
  return usePluginRegistryStore.getState().commands;
}

export function getSidebarPanels(): RegisteredSidebarPanel[] {
  return usePluginRegistryStore.getState().sidebarPanels;
}

export function markPluginPageRendered(pageId: string): void {
  pageCleanupState.set(pageId, true);
}

export function runPluginPageCleanup(page: RegisteredPluginPage): void {
  runPageCleanup(page);
}

export function clearAll(): void {
  usePluginRegistryStore.getState().clearAll();
}
