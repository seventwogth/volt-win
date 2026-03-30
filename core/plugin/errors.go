package plugin

import "errors"

var (
	ErrNotFound            = errors.New("plugin not found")
	ErrManifestNotFound    = errors.New("plugin manifest not found in archive")
	ErrMultiplePluginRoots = errors.New("archive contains multiple plugin manifests")
	ErrInvalidManifest     = errors.New("plugin manifest is invalid")
	ErrMainEntryMissing    = errors.New("plugin main entry is missing")
	ErrInvalidArchivePath  = errors.New("plugin archive contains an invalid path")
)

type ErrUnsupportedAPIVersion struct {
	PluginID   string
	APIVersion int
}

func (e *ErrUnsupportedAPIVersion) Error() string {
	if e == nil {
		return "plugin api version is unsupported"
	}

	if e.PluginID == "" {
		return "plugin api version is unsupported"
	}

	return `plugin "` + e.PluginID + `" uses unsupported apiVersion`
}

type ErrAlreadyExists struct {
	PluginID string
}

func (e *ErrAlreadyExists) Error() string {
	if e == nil || e.PluginID == "" {
		return "plugin already exists"
	}

	return `plugin "` + e.PluginID + `" already exists`
}
