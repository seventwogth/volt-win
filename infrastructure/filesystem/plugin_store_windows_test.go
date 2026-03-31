//go:build windows

package filesystem

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	coreplugin "volt/core/plugin"
)

func TestImportPluginArchiveRejectsWindowsInvalidPluginID(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	archivePath := filepath.Join(tempDir, "plugin.zip")
	manifest := coreplugin.PluginManifest{
		APIVersion: pluginAPIV4,
		ID:         "bad:name",
		Name:       "Bad Plugin",
		Version:    "1.0.0",
		Main:       "main.js",
	}

	if err := writePluginArchive(archivePath, manifest); err != nil {
		t.Fatalf("writePluginArchive() error = %v", err)
	}

	store := &PluginStore{
		pluginsDir: filepath.Join(tempDir, "plugins"),
		stateFile:  filepath.Join(tempDir, "plugin-state.json"),
	}
	if err := os.MkdirAll(store.pluginsDir, 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	_, err := store.ImportPluginArchive(archivePath)
	if !errors.Is(err, coreplugin.ErrInvalidManifest) {
		t.Fatalf("ImportPluginArchive() error = %v, want %v", err, coreplugin.ErrInvalidManifest)
	}
}

func writePluginArchive(path string, manifest coreplugin.PluginManifest) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := zip.NewWriter(file)

	manifestWriter, err := writer.Create("manifest.json")
	if err != nil {
		return err
	}

	rawManifest, err := json.Marshal(manifest)
	if err != nil {
		return err
	}

	if _, err := manifestWriter.Write(rawManifest); err != nil {
		return err
	}

	mainWriter, err := writer.Create("main.js")
	if err != nil {
		return err
	}

	if _, err := mainWriter.Write([]byte("export default {};")); err != nil {
		return err
	}

	return writer.Close()
}
