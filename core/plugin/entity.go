package plugin

type PluginManifest struct {
	APIVersion  int                    `json:"apiVersion"`
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Version     string                 `json:"version"`
	Description string                 `json:"description"`
	Main        string                 `json:"main"`
	Permissions []string               `json:"permissions"`
	Settings    *PluginManifestSetting `json:"settings,omitempty"`
}

type PluginSettingOption struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type PluginSettingField struct {
	Key          string                `json:"key"`
	Type         string                `json:"type"`
	Label        string                `json:"label"`
	Description  string                `json:"description,omitempty"`
	DefaultValue any                   `json:"defaultValue"`
	Placeholder  string                `json:"placeholder,omitempty"`
	Min          *float64              `json:"min,omitempty"`
	Max          *float64              `json:"max,omitempty"`
	Step         *float64              `json:"step,omitempty"`
	Options      []PluginSettingOption `json:"options,omitempty"`
}

type PluginSettingsSection struct {
	ID          string               `json:"id"`
	Title       string               `json:"title,omitempty"`
	Description string               `json:"description,omitempty"`
	Fields      []PluginSettingField `json:"fields"`
}

type PluginManifestSetting struct {
	Sections []PluginSettingsSection `json:"sections,omitempty"`
}

type Plugin struct {
	Manifest PluginManifest `json:"manifest"`
	Enabled  bool           `json:"enabled"`
	DirPath  string         `json:"dirPath"`
}
