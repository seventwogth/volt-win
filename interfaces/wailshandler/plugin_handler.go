package wailshandler

import (
	"context"
	"strings"

	commandbase "volt/commands"
	commandplugin "volt/commands/plugin"
	commandssystem "volt/commands/system"
	domain "volt/core/plugin"
	coresettings "volt/core/settings"
)

func NewPluginCatalogHandler(
	manager *commandbase.Manager,
	localization *coresettings.LocalizationService,
) *PluginCatalogHandler {
	return &PluginCatalogHandler{
		manager:      manager,
		localization: localization,
	}
}

type PluginCatalogHandler struct {
	manager      *commandbase.Manager
	localization *coresettings.LocalizationService
}

func (h *PluginCatalogHandler) ListPlugins() ([]domain.Plugin, error) {
	result, err := commandbase.Execute[commandplugin.ListResponse](
		context.Background(),
		h.manager,
		commandplugin.ListName,
		commandplugin.ListRequest{},
	)
	if err != nil {
		return nil, localizedUnexpectedError(h.localization, "backend.action.listPlugins", nil, err)
	}
	return result.Plugins, nil
}

func (h *PluginCatalogHandler) GetPluginsDirectory() (string, error) {
	result, err := commandbase.Execute[commandplugin.GetPluginsDirectoryResponse](
		context.Background(),
		h.manager,
		commandplugin.GetPluginsDirectoryName,
		commandplugin.GetPluginsDirectoryRequest{},
	)
	if err != nil {
		return "", localizedUnexpectedError(h.localization, "backend.action.getPluginsDirectory", nil, err)
	}

	return result.Path, nil
}

func (h *PluginCatalogHandler) SetPluginEnabled(pluginID string, enabled bool) error {
	_, err := commandbase.Execute[commandplugin.SetEnabledResponse](
		context.Background(),
		h.manager,
		commandplugin.SetEnabledName,
		commandplugin.SetEnabledRequest{PluginID: pluginID, Enabled: enabled},
	)
	if err != nil {
		return localizedPluginError(h.localization, "backend.action.togglePlugin", fmtKeyValue("pluginId", pluginID), err)
	}
	return nil
}

func (h *PluginCatalogHandler) PickPluginArchive() (string, error) {
	selection, err := commandbase.Execute[commandssystem.PickFileResponse](
		context.Background(),
		h.manager,
		commandssystem.PickPluginArchiveName,
		commandssystem.PickFileRequest{
			Title: translate(h.localization, "dialog.selectPluginArchive", nil),
			Filters: []commandssystem.FileFilter{
				{
					DisplayName: translate(h.localization, "dialog.pluginArchivesFilter", nil),
					Pattern:     "*.zip",
				},
			},
		},
	)
	if err != nil {
		return "", localizedUnexpectedError(h.localization, "backend.action.openPluginArchiveDialog", nil, err)
	}

	return selection.Path, nil
}

func (h *PluginCatalogHandler) ImportPluginArchive(archivePath string) (domain.Plugin, error) {
	result, err := commandbase.Execute[commandplugin.ImportArchiveResponse](
		context.Background(),
		h.manager,
		commandplugin.ImportArchiveName,
		commandplugin.ImportArchiveRequest{ArchivePath: archivePath},
	)
	if err != nil {
		return domain.Plugin{}, localizedPluginError(h.localization, "backend.action.importPluginArchive", nil, err)
	}

	return result.Plugin, nil
}

func (h *PluginCatalogHandler) DeletePlugin(pluginID string) error {
	_, err := commandbase.Execute[commandplugin.DeleteResponse](
		context.Background(),
		h.manager,
		commandplugin.DeleteName,
		commandplugin.DeleteRequest{PluginID: pluginID},
	)
	if err != nil {
		return localizedPluginError(h.localization, "backend.action.deletePlugin", fmtKeyValue("pluginId", pluginID), err)
	}

	return nil
}

type PluginRuntimeHandler struct {
	manager      *commandbase.Manager
	localization *coresettings.LocalizationService
}

func NewPluginRuntimeHandler(
	manager *commandbase.Manager,
	localization *coresettings.LocalizationService,
) *PluginRuntimeHandler {
	return &PluginRuntimeHandler{
		manager:      manager,
		localization: localization,
	}
}

func (h *PluginRuntimeHandler) LoadPluginSource(pluginID string) (string, error) {
	result, err := commandbase.Execute[commandplugin.LoadSourceResponse](
		context.Background(),
		h.manager,
		commandplugin.LoadSourceName,
		commandplugin.LoadSourceRequest{PluginID: pluginID},
	)
	if err != nil {
		return "", localizedPluginError(h.localization, "backend.action.loadPlugin", fmtKeyValue("pluginId", pluginID), err)
	}
	return result.Source, nil
}

func (h *PluginRuntimeHandler) GetPluginData(pluginID, key string) (string, error) {
	result, err := commandbase.Execute[commandplugin.GetDataResponse](
		context.Background(),
		h.manager,
		commandplugin.GetDataName,
		commandplugin.GetDataRequest{PluginID: pluginID, Key: key},
	)
	if err != nil {
		return "", localizedPluginError(h.localization, "backend.action.getPluginData", nil, err)
	}
	return result.Value, nil
}

func (h *PluginRuntimeHandler) SetPluginData(pluginID, key, value string) error {
	_, err := commandbase.Execute[commandplugin.SetDataResponse](
		context.Background(),
		h.manager,
		commandplugin.SetDataName,
		commandplugin.SetDataRequest{PluginID: pluginID, Key: key, Value: value},
	)
	if err != nil {
		return localizedPluginError(h.localization, "backend.action.setPluginData", nil, err)
	}
	return nil
}

func (h *PluginRuntimeHandler) PickPluginFiles(title string, accept []string, multiple bool) ([]string, error) {
	resolvedTitle := strings.TrimSpace(title)
	if resolvedTitle == "" {
		if multiple {
			resolvedTitle = translate(h.localization, "dialog.selectFiles", nil)
		} else {
			resolvedTitle = translate(h.localization, "dialog.selectFile", nil)
		}
	}

	result, err := commandbase.Execute[commandssystem.PickFilesResponse](
		context.Background(),
		h.manager,
		commandssystem.PickFilesName,
		commandssystem.PickFileRequest{
			Title:    resolvedTitle,
			Filters:  buildPluginFileFilters(h.localization, accept),
			Multiple: multiple,
		},
	)
	if err != nil {
		return nil, localizedUnexpectedError(h.localization, "backend.action.openFileDialog", nil, err)
	}

	return result.Paths, nil
}

func (h *PluginRuntimeHandler) CopyPluginAsset(voltPath, sourcePath, targetDir string) (string, error) {
	result, err := commandbase.Execute[commandssystem.CopyAssetResponse](
		context.Background(),
		h.manager,
		commandssystem.CopyAssetName,
		commandssystem.CopyAssetRequest{
			VoltPath:   voltPath,
			SourcePath: sourcePath,
			TargetDir:  targetDir,
		},
	)
	if err != nil {
		return "", localizedUnexpectedError(h.localization, "backend.action.copyAsset", nil, err)
	}

	return result.RelativePath, nil
}

func buildPluginFileFilters(localization *coresettings.LocalizationService, accept []string) []commandssystem.FileFilter {
	patterns := make([]string, 0, len(accept))
	for _, rawPattern := range accept {
		patterns = append(patterns, expandPluginFilePatterns(rawPattern)...)
	}

	if len(patterns) == 0 {
		patterns = []string{"*"}
	}

	return []commandssystem.FileFilter{{
		DisplayName: translate(localization, "dialog.filesFilter", nil),
		Pattern:     strings.Join(patterns, ";"),
	}}
}

func expandPluginFilePatterns(rawPattern string) []string {
	pattern := strings.TrimSpace(rawPattern)
	if pattern == "" {
		return nil
	}

	switch strings.ToLower(pattern) {
	case "image/*":
		return []string{"*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.svg", "*.avif"}
	case "video/*":
		return []string{"*.mp4", "*.mov", "*.webm", "*.m4v", "*.mkv"}
	case "audio/*":
		return []string{"*.mp3", "*.wav", "*.ogg", "*.m4a", "*.aac", "*.flac"}
	}

	if strings.HasPrefix(pattern, ".") {
		return []string{"*" + pattern}
	}

	if !strings.Contains(pattern, "*") && !strings.Contains(pattern, ".") && !strings.Contains(pattern, "/") {
		return []string{"*." + pattern}
	}

	return []string{pattern}
}
