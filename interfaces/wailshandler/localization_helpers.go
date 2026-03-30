package wailshandler

import (
	"errors"

	corefile "volt/core/file"
	coreplugin "volt/core/plugin"
	coresettings "volt/core/settings"
	corevolt "volt/core/volt"
)

func translate(localization *coresettings.LocalizationService, key string, params map[string]any) string {
	if localization == nil {
		return key
	}
	return localization.Translate(key, params)
}

func localizedUnexpectedError(localization *coresettings.LocalizationService, actionKey string, params map[string]any, err error) error {
	action := translate(localization, actionKey, params)
	return errors.New(translate(localization, "backend.error.withDetail", map[string]any{
		"action": action,
		"detail": err.Error(),
	}))
}

func localizedVoltError(localization *coresettings.LocalizationService, actionKey string, params map[string]any, err error) error {
	switch {
	case errors.Is(err, corevolt.ErrNotFound):
		return errors.New(translate(localization, "backend.error.volt.notFound", nil))
	case errors.Is(err, corevolt.ErrPathNotAccessible):
		return errors.New(translate(localization, "backend.error.volt.pathNotAccessible", nil))
	case errors.Is(err, corevolt.ErrAlreadyExists):
		return errors.New(translate(localization, "backend.error.volt.alreadyExists", nil))
	default:
		return localizedUnexpectedError(localization, actionKey, params, err)
	}
}

func localizedFileError(localization *coresettings.LocalizationService, actionKey string, params map[string]any, err error) error {
	switch {
	case errors.Is(err, corefile.ErrFileNotFound):
		return errors.New(translate(localization, "backend.error.file.notFound", nil))
	case errors.Is(err, corefile.ErrPermissionDenied):
		return errors.New(translate(localization, "backend.error.file.permissionDenied", nil))
	case errors.Is(err, corefile.ErrPathTraversal):
		return errors.New(translate(localization, "backend.error.file.pathTraversal", nil))
	case errors.Is(err, corefile.ErrAlreadyExists):
		return errors.New(translate(localization, "backend.error.file.alreadyExists", nil))
	default:
		return localizedUnexpectedError(localization, actionKey, params, err)
	}
}

func localizedImageError(localization *coresettings.LocalizationService, actionKey string, params map[string]any, err error) error {
	return localizedUnexpectedError(localization, actionKey, params, err)
}

func localizedPluginError(localization *coresettings.LocalizationService, actionKey string, params map[string]any, err error) error {
	var alreadyExistsErr *coreplugin.ErrAlreadyExists
	var unsupportedVersionErr *coreplugin.ErrUnsupportedAPIVersion

	switch {
	case errors.Is(err, coreplugin.ErrNotFound):
		return errors.New(translate(localization, "backend.error.plugin.notFound", nil))
	case errors.As(err, &alreadyExistsErr):
		return errors.New(translate(localization, "backend.error.plugin.alreadyExists", map[string]any{
			"pluginId": alreadyExistsErr.PluginID,
		}))
	case errors.Is(err, coreplugin.ErrManifestNotFound):
		return errors.New(translate(localization, "backend.error.plugin.manifestNotFound", nil))
	case errors.Is(err, coreplugin.ErrMultiplePluginRoots):
		return errors.New(translate(localization, "backend.error.plugin.multiplePayloads", nil))
	case errors.Is(err, coreplugin.ErrInvalidManifest):
		return errors.New(translate(localization, "backend.error.plugin.invalidManifest", nil))
	case errors.Is(err, coreplugin.ErrMainEntryMissing):
		return errors.New(translate(localization, "backend.error.plugin.mainEntryMissing", nil))
	case errors.Is(err, coreplugin.ErrInvalidArchivePath):
		return errors.New(translate(localization, "backend.error.plugin.invalidArchivePath", nil))
	case errors.As(err, &unsupportedVersionErr):
		return errors.New(translate(localization, "backend.error.plugin.unsupportedApiVersion", map[string]any{
			"apiVersion": unsupportedVersionErr.APIVersion,
		}))
	default:
		return localizedUnexpectedError(localization, actionKey, params, err)
	}
}

func quotedPathParam(path string) map[string]any {
	return map[string]any{"path": path}
}

func renameParams(oldPath, newPath string) map[string]any {
	return map[string]any{
		"oldPath": oldPath,
		"newPath": newPath,
	}
}

func fmtKeyValue(key string, value any) map[string]any {
	return map[string]any{key: value}
}
