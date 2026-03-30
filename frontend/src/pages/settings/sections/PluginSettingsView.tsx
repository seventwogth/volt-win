import { useEffect, useMemo } from 'react';
import { ensurePluginSettingsLoaded, getMergedPluginSettings, setPluginSettingValue, usePluginSettingsStore } from '@entities/plugin';
import { usePluginLogStore } from '@entities/plugin';
import type { PluginInfo, PluginSettingField, PluginSettingsSection } from '@shared/api/plugin';
import { Toggle } from '@shared/ui/toggle';
import { TextArea } from '@shared/ui/textarea';
import { NumberInput } from '@shared/ui/number-input';
import { useI18n } from '@app/providers/I18nProvider';
import styles from '../SettingsPage.module.scss';

const EMPTY_PLUGIN_SETTINGS: Record<string, unknown> = {};

interface PluginSettingsViewProps {
  plugin: PluginInfo;
}

function renderFieldValue(
  pluginId: string,
  field: PluginSettingField,
  value: unknown,
  sections: PluginSettingsSection[],
) {
  if (field.type === 'toggle') {
    return (
      <Toggle
        value={value === true}
        onChange={(nextValue) => {
          void setPluginSettingValue(pluginId, field.key, nextValue, sections);
        }}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <TextArea
        value={typeof value === 'string' ? value : field.defaultValue}
        placeholder={field.placeholder}
        onChange={(event) => {
          void setPluginSettingValue(pluginId, field.key, event.target.value, sections);
        }}
      />
    );
  }

  if (field.type === 'text') {
    return (
      <input
        type="text"
        className={styles.textInput}
        value={typeof value === 'string' ? value : field.defaultValue}
        placeholder={field.placeholder}
        onChange={(event) => {
          void setPluginSettingValue(pluginId, field.key, event.target.value, sections);
        }}
      />
    );
  }

  if (field.type === 'number') {
    const numValue = typeof value === 'number' && Number.isFinite(value) ? value : '';
    return (
      <NumberInput
        value={numValue}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(nextValue) => {
          void setPluginSettingValue(
            pluginId,
            field.key,
            nextValue === '' ? field.defaultValue : nextValue,
            sections,
          );
        }}
      />
    );
  }

  return (
    <select
      value={typeof value === 'string' ? value : field.defaultValue}
      onChange={(event) => {
        void setPluginSettingValue(pluginId, field.key, event.target.value, sections);
      }}
    >
      {field.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function PluginSettingsView({ plugin }: PluginSettingsViewProps) {
  const { t } = useI18n();
  const sections = plugin.manifest.settings?.sections ?? [];
  const pluginId = plugin.manifest.id;
  const rawPluginValues = usePluginSettingsStore((state) => state.valuesByPlugin[pluginId]);
  const rawValues = rawPluginValues ?? EMPTY_PLUGIN_SETTINGS;
  const logEntries = usePluginLogStore((state) => state.entries);
  const clearPluginLog = usePluginLogStore((state) => state.clearByPlugin);
  const pluginLogEntries = useMemo(
    () => logEntries.filter((entry) => entry.pluginId === pluginId),
    [logEntries, pluginId],
  );

  useEffect(() => {
    void ensurePluginSettingsLoaded(pluginId).catch(() => undefined);
  }, [pluginId]);

  const mergedValues = getMergedPluginSettings(pluginId, sections, rawValues);

  return (
    <div className={styles.section}>
      <div className={styles.pluginSettingsHeader}>
        <div>
          <h2>{plugin.manifest.name}</h2>
          {plugin.manifest.description && (
            <p className={styles.sectionDescription}>{plugin.manifest.description}</p>
          )}
        </div>
        <div className={`${styles.statusBadge} ${plugin.enabled ? styles.statusEnabled : styles.statusDisabled}`}>
          {plugin.enabled ? t('common.enabled') : t('common.disabled')}
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id} className={styles.pluginSettingsSectionCard}>
          {section.title && <h3 className={styles.pluginSettingsTitle}>{section.title}</h3>}
          {section.description && (
            <p className={styles.pluginSettingsDescription}>{section.description}</p>
          )}
          <div className={styles.pluginSettingsFields}>
            {section.fields.map((field) => (
              <div key={field.key} className={styles.pluginFieldRow}>
                <div className={styles.pluginFieldBody}>
                  <div className={styles.pluginFieldLabel}>{field.label}</div>
                  {field.description && (
                    <div className={styles.pluginFieldDescription}>{field.description}</div>
                  )}
                </div>
                <div className={styles.pluginFieldControl}>
                  {renderFieldValue(pluginId, field, mergedValues[field.key], sections)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {pluginLogEntries.length > 0 && (
        <div className={styles.logSection}>
          <div className={styles.logHeader}>
            <h3>{t('settings.plugins.logTitle')}</h3>
            <button
              type="button"
              className={styles.clearLogsButton}
              onClick={() => clearPluginLog(pluginId)}
            >
              {t('settings.plugins.logClear')}
            </button>
          </div>
          <div className={styles.logList}>
            {[...pluginLogEntries].reverse().map((entry) => (
              <div key={entry.id} className={styles.logItem}>
                <div className={styles.logMeta}>
                  <span className={styles.logLevel}>{entry.level}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div className={styles.logMessage}>{entry.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
