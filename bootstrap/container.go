package bootstrap

import (
	"log"
	"path/filepath"

	commandbase "volt/commands"
	commandfile "volt/commands/file"
	commandnote "volt/commands/note"
	commandplugin "volt/commands/plugin"
	commandsearch "volt/commands/search"
	commandsettings "volt/commands/settings"
	commandssystem "volt/commands/system"
	commandvolt "volt/commands/volt"
	coresettings "volt/core/settings"
	"volt/infrastructure/filesystem"
	"volt/infrastructure/persistence/local"
	wailsruntime "volt/infrastructure/runtime/wails"
	"volt/interfaces/wailshandler"
)

type Container struct {
	Lifecycle       *wailshandler.Lifecycle
	voltHandler     *wailshandler.VoltHandler
	fileHandler     *wailshandler.FileHandler
	noteHandler     *wailshandler.NoteHandler
	searchHandler   *wailshandler.SearchHandler
	pluginCatalog   *wailshandler.PluginCatalogHandler
	pluginRuntime   *wailshandler.PluginRuntimeHandler
	imageHandler    *wailshandler.ImageHandler
	settingsHandler *wailshandler.SettingsHandler
}

func NewContainer() *Container {
	// Persistence
	voltStore, err := local.NewVoltStore()
	if err != nil {
		log.Fatalf("failed to initialize volt store: %v", err)
	}

	settingsStore, err := local.NewAppSettingsStore()
	if err != nil {
		log.Fatalf("failed to initialize settings store: %v", err)
	}

	localization, err := coresettings.NewLocalizationService(settingsStore, filepath.Join(settingsStore.ConfigDir(), "locales"))
	if err != nil {
		log.Fatalf("failed to initialize localization service: %v", err)
	}

	fileRepo := filesystem.NewFileRepository()
	runtime := wailsruntime.NewRuntime()

	pluginStore, err := filesystem.NewPluginStore()
	if err != nil {
		log.Fatalf("failed to initialize plugin store: %v", err)
	}

	processService := commandssystem.NewPluginProcessService(runtime)
	manager := commandbase.MustNewManager(
		commandvolt.NewListCommand(voltStore),
		commandvolt.NewCreateCommand(voltStore),
		commandvolt.NewDeleteCommand(voltStore),
		commandfile.NewReadCommand(fileRepo),
		commandfile.NewSaveCommand(fileRepo),
		commandfile.NewListTreeCommand(fileRepo),
		commandnote.NewCreateNoteCommand(fileRepo),
		commandfile.NewCreateFileCommand(fileRepo),
		commandfile.NewCreateDirectoryCommand(fileRepo),
		commandfile.NewDeleteCommand(fileRepo),
		commandfile.NewRenameCommand(fileRepo),
		commandsearch.NewSearchFilesCommand(fileRepo),
		commandplugin.NewListCommand(pluginStore),
		commandplugin.NewGetPluginsDirectoryCommand(pluginStore),
		commandplugin.NewLoadSourceCommand(pluginStore),
		commandplugin.NewSetEnabledCommand(pluginStore),
		commandplugin.NewImportArchiveCommand(pluginStore),
		commandplugin.NewDeleteCommand(pluginStore),
		commandplugin.NewGetDataCommand(pluginStore),
		commandplugin.NewSetDataCommand(pluginStore),
		commandsettings.NewGetLocalizationCommand(localization),
		commandsettings.NewSetLocaleCommand(localization),
		commandssystem.NewSelectDirectoryCommand(runtime),
		commandssystem.NewPickPluginArchiveCommand(runtime),
		commandssystem.NewPickImageCommand(runtime),
		commandssystem.NewPickFilesCommand(runtime),
		commandssystem.NewCopyAssetCommand(),
		commandssystem.NewCopyImageCommand(),
		commandssystem.NewSaveImageBase64Command(),
		commandssystem.NewReadImageBase64Command(),
		commandssystem.NewStartPluginProcessCommand(processService),
		commandssystem.NewCancelPluginProcessCommand(processService),
	)

	lifecycle := wailshandler.NewLifecycle(runtime)
	voltHandler := wailshandler.NewVoltHandler(manager, localization)
	fileHandler := wailshandler.NewFileHandler(manager, localization)
	noteHandler := wailshandler.NewNoteHandler(manager, localization)
	searchHandler := wailshandler.NewSearchHandler(manager, localization)
	pluginCatalog := wailshandler.NewPluginCatalogHandler(manager, localization)
	pluginRuntime := wailshandler.NewPluginRuntimeHandler(manager, localization)
	imageHandler := wailshandler.NewImageHandler(manager, localization)
	settingsHandler := wailshandler.NewSettingsHandler(manager)

	return &Container{
		Lifecycle:       lifecycle,
		voltHandler:     voltHandler,
		fileHandler:     fileHandler,
		noteHandler:     noteHandler,
		searchHandler:   searchHandler,
		pluginCatalog:   pluginCatalog,
		pluginRuntime:   pluginRuntime,
		imageHandler:    imageHandler,
		settingsHandler: settingsHandler,
	}
}

func (c *Container) Bindings() []interface{} {
	return []interface{}{
		c.voltHandler,
		c.fileHandler,
		c.noteHandler,
		c.searchHandler,
		c.pluginCatalog,
		c.pluginRuntime,
		c.imageHandler,
		c.settingsHandler,
	}
}
