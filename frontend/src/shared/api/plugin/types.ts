export interface PluginSettingOption {
  label: string;
  value: string;
}

interface PluginSettingFieldBase<TType extends string, TValue> {
  key: string;
  type: TType;
  label: string;
  description?: string;
  defaultValue: TValue;
}

export type PluginSettingField =
  | (PluginSettingFieldBase<'toggle', boolean>)
  | (PluginSettingFieldBase<'text', string> & {
      placeholder?: string;
    })
  | (PluginSettingFieldBase<'textarea', string> & {
      placeholder?: string;
    })
  | (PluginSettingFieldBase<'number', number> & {
      min?: number;
      max?: number;
      step?: number;
    })
  | (PluginSettingFieldBase<'select', string> & {
      options: PluginSettingOption[];
    });

export interface PluginSettingsSection {
  id: string;
  title?: string;
  description?: string;
  fields: PluginSettingField[];
}

export interface PluginManifestSettings {
  sections?: PluginSettingsSection[];
}

export interface PluginManifest {
  apiVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  permissions: string[];
  settings?: PluginManifestSettings;
}

export interface PluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  dirPath: string;
}
