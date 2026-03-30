import type { PluginInfo } from '@shared/api/plugin';
import { Toggle } from '@shared/ui/toggle';
import { Button } from '@shared/ui/button';
import { useI18n } from '@app/providers/I18nProvider';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';
import styles from '../SettingsPage.module.scss';

interface PluginListSectionProps {
  plugins: PluginInfo[];
  pluginsDirectory: string;
  importingPlugin: boolean;
  busyPluginId: string | null;
  deletingPluginId: string | null;
  onImport: () => void;
  onToggle: (plugin: PluginInfo) => void;
  onRequestDelete: (plugin: PluginInfo) => void;
}

export function PluginListSection({
  plugins,
  pluginsDirectory,
  importingPlugin,
  busyPluginId,
  deletingPluginId,
  onImport,
  onToggle,
  onRequestDelete,
}: PluginListSectionProps) {
  const { t } = useI18n();
  const handleOpenPluginsDirectory = () => {
    if (!pluginsDirectory) {
      return;
    }

    void BrowserOpenURL(encodeURI(`file://${pluginsDirectory}`));
  };

  return (
    <div className={styles.section}>
      <div className={styles.pluginToolbar}>
        <div>
          <h2>{t('settings.plugins.title')}</h2>
          <p className={styles.sectionDescription}>{t('settings.plugins.description')}</p>
          {pluginsDirectory && (
            <p className={styles.sectionDescription}>
              {t('settings.plugins.folderDescription', { path: pluginsDirectory })}
            </p>
          )}
        </div>
        <div className={styles.pluginActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenPluginsDirectory}
            disabled={!pluginsDirectory}
          >
            {t('settings.plugins.openFolderButton')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onImport}
            disabled={importingPlugin}
          >
            {importingPlugin ? t('settings.plugins.importing') : t('settings.plugins.importButton')}
          </Button>
        </div>
      </div>
      {plugins.length === 0 ? (
        <p className={styles.emptyMessage}>{t('settings.plugins.empty')}</p>
      ) : (
        <div className={styles.pluginList}>
          {plugins.map((plugin) => {
            const isBusy = busyPluginId === plugin.manifest.id || deletingPluginId === plugin.manifest.id;
            return (
              <div key={plugin.manifest.id} className={styles.pluginCard}>
                <div className={styles.pluginItem}>
                  <div className={styles.pluginInfo}>
                    <div className={styles.pluginName}>
                      {plugin.manifest.name}
                      <span className={styles.pluginVersion}>v{plugin.manifest.version}</span>
                    </div>
                    {plugin.manifest.description && (
                      <div className={styles.pluginDescription}>{plugin.manifest.description}</div>
                    )}
                  </div>
                  <div className={styles.pluginActions}>
                    <Toggle
                      value={plugin.enabled}
                      onChange={() => onToggle(plugin)}
                      disabled={isBusy}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onRequestDelete(plugin)}
                      disabled={isBusy}
                    >
                      {deletingPluginId === plugin.manifest.id ? t('settings.plugins.deleting') : t('common.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
