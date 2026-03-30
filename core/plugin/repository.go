package plugin

type Repository interface {
	ListPlugins() ([]Plugin, error)
	GetPluginsDirectory() string
	LoadPluginSource(pluginID string) (string, error)
	SetPluginEnabled(pluginID string, enabled bool) error
	ImportPluginArchive(archivePath string) (Plugin, error)
	DeletePlugin(pluginID string) error
	GetPluginData(pluginID, key string) (string, error)
	SetPluginData(pluginID, key, value string) error
}
