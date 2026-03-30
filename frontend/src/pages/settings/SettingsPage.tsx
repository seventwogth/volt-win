import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShortcutSettingsSection } from '@features/shortcut-settings';
import { PermissionDialog } from '@features/plugin-permission';
import { Button } from '@shared/ui/button';
import { Icon } from '@shared/ui/icon';
import { Modal } from '@shared/ui/modal';
import { useI18n } from '@app/providers/I18nProvider';
import { usePluginManagement } from './hooks/usePluginManagement';
import { GeneralSettingsSection } from './sections/GeneralSettingsSection';
import { AboutSection } from './sections/AboutSection';
import { PluginListSection } from './sections/PluginListSection';
import { PluginSettingsView } from './sections/PluginSettingsView';
import styles from './SettingsPage.module.scss';

export type SettingsSection = 'general' | 'shortcuts' | 'plugins' | 'about' | 'plugin';

interface SettingsPageProps {
  section?: SettingsSection;
  pluginId?: string;
}

export function SettingsPage({
  section = 'general',
  pluginId,
}: SettingsPageProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  const {
    plugins,
    pluginsDirectory,
    pluginsLoaded,
    settingsPlugins,
    confirmPlugin,
    setConfirmPlugin,
    pluginPendingDeletion,
    setPluginPendingDeletion,
    importingPlugin,
    busyPluginId,
    deletingPluginId,
    handleTogglePlugin,
    handleImportPlugin,
    handleConfirmDeletePlugin,
    applyPluginToggle,
  } = usePluginManagement();

  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.manifest.id === pluginId) ?? null,
    [pluginId, plugins],
  );

  const hasSelectedPluginSettings = (selectedPlugin?.manifest.settings?.sections ?? []).length > 0;
  const canOpenSelectedPluginSettings = Boolean(selectedPlugin?.enabled) && hasSelectedPluginSettings;

  const navItems = useMemo(() => [
    { key: 'general', label: t('settings.tab.general'), path: '/settings' },
    { key: 'shortcuts', label: t('settings.tab.shortcuts'), path: '/settings/shortcuts' },
    { key: 'plugins', label: t('settings.tab.plugins'), path: '/settings/plugins' },
    ...settingsPlugins.map((plugin) => ({
      key: `plugin:${plugin.manifest.id}`,
      label: plugin.manifest.name,
      path: `/settings/plugin/${plugin.manifest.id}`,
    })),
    { key: 'about', label: t('settings.tab.about'), path: '/settings/about' },
  ], [settingsPlugins, t]);

  const activeNavKey = section === 'plugin' && pluginId ? `plugin:${pluginId}` : section;

  if (section === 'plugin' && pluginsLoaded && (!selectedPlugin || !canOpenSelectedPluginSettings)) {
    return <Navigate to="/settings/plugins" replace />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size={16} /> {t('common.back')}
        </button>
        <h1>{t('settings.title')}</h1>
      </div>
      <div className={styles.layout}>
        <nav className={styles.tabs}>
          {navItems.map((item) => (
            <button
              key={item.key}
              className={activeNavKey === item.key ? styles.activeTab : styles.tab}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className={styles.content}>
          {section === 'general' && <GeneralSettingsSection />}
          {section === 'shortcuts' && <ShortcutSettingsSection />}
          {section === 'plugins' && (
            <PluginListSection
              plugins={plugins}
              pluginsDirectory={pluginsDirectory}
              importingPlugin={importingPlugin}
              busyPluginId={busyPluginId}
              deletingPluginId={deletingPluginId}
              onImport={() => { void handleImportPlugin(); }}
              onToggle={(plugin) => { void handleTogglePlugin(plugin); }}
              onRequestDelete={setPluginPendingDeletion}
            />
          )}
          {section === 'plugin' && selectedPlugin && canOpenSelectedPluginSettings && (
            <PluginSettingsView plugin={selectedPlugin} />
          )}
          {section === 'about' && <AboutSection />}
        </div>
      </div>

      <PermissionDialog
        isOpen={confirmPlugin != null}
        plugin={confirmPlugin}
        onCancel={() => setConfirmPlugin(null)}
        onConfirm={() => {
          const plugin = confirmPlugin;
          setConfirmPlugin(null);
          if (plugin) {
            void applyPluginToggle(plugin, true).catch(() => undefined);
          }
        }}
      />

      <Modal
        isOpen={pluginPendingDeletion != null}
        onClose={() => {
          if (deletingPluginId == null) {
            setPluginPendingDeletion(null);
          }
        }}
        title={t('settings.plugins.delete.title')}
      >
        <div className={styles.dialogBody}>
          <p className={styles.dialogDescription}>
            {pluginPendingDeletion
              ? t('settings.plugins.delete.description', { name: pluginPendingDeletion.manifest.name })
              : ''}
          </p>
          <div className={styles.dialogActions}>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setPluginPendingDeletion(null)}
              disabled={deletingPluginId != null}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => { void handleConfirmDeletePlugin(); }}
              disabled={pluginPendingDeletion == null || deletingPluginId != null}
            >
              {deletingPluginId != null ? t('settings.plugins.deleting') : t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
