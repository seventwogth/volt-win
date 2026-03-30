package filesystem

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	coreplugin "volt/core/plugin"
)

const (
	pluginConfigDir = ".volt"
	pluginsSubDir   = "plugins"
	stateFile       = "plugin-state.json"
	manifestFile    = "manifest.json"
	dataFile        = "data.json"
	pluginAPIV4     = 4
)

type PluginStore struct {
	mu         sync.RWMutex
	pluginsDir string
	stateFile  string
}

func NewPluginStore() (*PluginStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	pluginsDir := filepath.Join(home, pluginConfigDir, pluginsSubDir)
	if err := os.MkdirAll(pluginsDir, 0755); err != nil {
		return nil, err
	}

	sf := filepath.Join(home, pluginConfigDir, stateFile)

	return &PluginStore{
		pluginsDir: pluginsDir,
		stateFile:  sf,
	}, nil
}

func (s *PluginStore) ListPlugins() ([]coreplugin.Plugin, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.pluginsDir)
	if err != nil {
		return []coreplugin.Plugin{}, nil
	}

	state, _ := s.readState()

	var plugins []coreplugin.Plugin
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dirPath := filepath.Join(s.pluginsDir, entry.Name())
		manifestPath := filepath.Join(dirPath, manifestFile)

		data, err := os.ReadFile(manifestPath)
		if err != nil {
			continue
		}

		var manifest coreplugin.PluginManifest
		if err := json.Unmarshal(data, &manifest); err != nil {
			continue
		}

		if err := validateManifest(manifest); err != nil {
			continue
		}

		enabled := state[manifest.ID]

		plugins = append(plugins, coreplugin.Plugin{
			Manifest: manifest,
			Enabled:  enabled,
			DirPath:  dirPath,
		})
	}

	if plugins == nil {
		plugins = []coreplugin.Plugin{}
	}

	return plugins, nil
}

func (s *PluginStore) GetPluginsDirectory() string {
	return s.pluginsDir
}

func (s *PluginStore) LoadPluginSource(pluginID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	p, err := s.findPlugin(pluginID)
	if err != nil {
		return "", err
	}

	sourcePath := filepath.Join(p.DirPath, p.Manifest.Main)
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func (s *PluginStore) SetPluginEnabled(pluginID string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state, _ := s.readState()
	if state == nil {
		state = make(map[string]bool)
	}

	state[pluginID] = enabled

	return s.writeState(state)
}

func (s *PluginStore) ImportPluginArchive(archivePath string) (coreplugin.Plugin, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tempDir, err := os.MkdirTemp("", "volt-plugin-import-*")
	if err != nil {
		return coreplugin.Plugin{}, err
	}
	defer os.RemoveAll(tempDir)

	manifest, payloadDir, err := extractPluginArchive(archivePath, tempDir)
	if err != nil {
		return coreplugin.Plugin{}, err
	}

	if strings.TrimSpace(manifest.ID) == "" {
		return coreplugin.Plugin{}, coreplugin.ErrInvalidManifest
	}

	if strings.TrimSpace(manifest.Main) == "" {
		return coreplugin.Plugin{}, coreplugin.ErrMainEntryMissing
	}

	if err := validateManifest(manifest); err != nil {
		return coreplugin.Plugin{}, err
	}

	if _, err := s.findPlugin(manifest.ID); err == nil {
		return coreplugin.Plugin{}, &coreplugin.ErrAlreadyExists{PluginID: manifest.ID}
	} else if !errors.Is(err, coreplugin.ErrNotFound) {
		return coreplugin.Plugin{}, err
	}

	targetDir := filepath.Join(s.pluginsDir, manifest.ID)
	if _, err := os.Stat(targetDir); err == nil {
		return coreplugin.Plugin{}, &coreplugin.ErrAlreadyExists{PluginID: manifest.ID}
	} else if err != nil && !os.IsNotExist(err) {
		return coreplugin.Plugin{}, err
	}

	mainPath := filepath.Join(payloadDir, filepath.Clean(manifest.Main))
	insidePayload, err := isWithinBaseDir(payloadDir, mainPath)
	if err != nil {
		return coreplugin.Plugin{}, err
	}

	if !insidePayload {
		return coreplugin.Plugin{}, coreplugin.ErrInvalidManifest
	}

	mainInfo, err := os.Stat(mainPath)
	if err != nil || mainInfo.IsDir() {
		return coreplugin.Plugin{}, coreplugin.ErrMainEntryMissing
	}

	if err := copyDir(payloadDir, targetDir); err != nil {
		return coreplugin.Plugin{}, err
	}

	return coreplugin.Plugin{
		Manifest: manifest,
		Enabled:  false,
		DirPath:  targetDir,
	}, nil
}

func (s *PluginStore) DeletePlugin(pluginID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pluginInfo, err := s.findPlugin(pluginID)
	if err != nil {
		return err
	}

	if err := os.RemoveAll(pluginInfo.DirPath); err != nil {
		return err
	}

	state, _ := s.readState()
	delete(state, pluginID)
	return s.writeState(state)
}

func (s *PluginStore) GetPluginData(pluginID, key string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	dataMap, _ := s.readPluginData(pluginID)
	val, ok := dataMap[key]
	if !ok {
		return "", nil
	}
	return val, nil
}

func (s *PluginStore) SetPluginData(pluginID, key, value string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dataMap, _ := s.readPluginData(pluginID)
	if dataMap == nil {
		dataMap = make(map[string]string)
	}

	dataMap[key] = value

	return s.writePluginData(pluginID, dataMap)
}

// --- internal helpers ---

func (s *PluginStore) readState() (map[string]bool, error) {
	data, err := os.ReadFile(s.stateFile)
	if err != nil {
		return make(map[string]bool), nil
	}
	var state map[string]bool
	if err := json.Unmarshal(data, &state); err != nil {
		return make(map[string]bool), nil
	}
	return state, nil
}

func (s *PluginStore) writeState(state map[string]bool) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.stateFile, data, 0644)
}

func (s *PluginStore) findPlugin(pluginID string) (*coreplugin.Plugin, error) {
	entries, err := os.ReadDir(s.pluginsDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dirPath := filepath.Join(s.pluginsDir, entry.Name())
		manifestPath := filepath.Join(dirPath, manifestFile)

		data, err := os.ReadFile(manifestPath)
		if err != nil {
			continue
		}

		var manifest coreplugin.PluginManifest
		if err := json.Unmarshal(data, &manifest); err != nil {
			continue
		}

		if manifest.ID == pluginID {
			return &coreplugin.Plugin{
				Manifest: manifest,
				DirPath:  dirPath,
			}, nil
		}
	}

	return nil, coreplugin.ErrNotFound
}

func (s *PluginStore) readPluginData(pluginID string) (map[string]string, error) {
	p, err := s.findPlugin(pluginID)
	if err != nil {
		return make(map[string]string), nil
	}

	dataPath := filepath.Join(p.DirPath, dataFile)
	raw, err := os.ReadFile(dataPath)
	if err != nil {
		return make(map[string]string), nil
	}

	var dataMap map[string]string
	if err := json.Unmarshal(raw, &dataMap); err != nil {
		return make(map[string]string), nil
	}

	return dataMap, nil
}

func (s *PluginStore) writePluginData(pluginID string, dataMap map[string]string) error {
	p, err := s.findPlugin(pluginID)
	if err != nil {
		return err
	}

	dataPath := filepath.Join(p.DirPath, dataFile)
	raw, err := json.MarshalIndent(dataMap, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(dataPath, raw, 0644)
}

func extractPluginArchive(archivePath, destination string) (coreplugin.PluginManifest, string, error) {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return coreplugin.PluginManifest{}, "", err
	}
	defer reader.Close()

	manifestRoots := make(map[string]struct{})

	for _, file := range reader.File {
		archivePath, err := normalizeArchivePath(file.Name)
		if err != nil {
			return coreplugin.PluginManifest{}, "", err
		}

		if archivePath == "" || shouldSkipArchiveEntry(archivePath) {
			continue
		}

		if path.Base(archivePath) != manifestFile {
			continue
		}

		root := path.Dir(archivePath)
		if root == "." {
			root = ""
		}
		manifestRoots[root] = struct{}{}
	}

	if len(manifestRoots) == 0 {
		return coreplugin.PluginManifest{}, "", coreplugin.ErrManifestNotFound
	}

	if len(manifestRoots) > 1 {
		return coreplugin.PluginManifest{}, "", coreplugin.ErrMultiplePluginRoots
	}

	selectedRoot := ""
	for root := range manifestRoots {
		selectedRoot = root
	}

	for _, file := range reader.File {
		archivePath, err := normalizeArchivePath(file.Name)
		if err != nil {
			return coreplugin.PluginManifest{}, "", err
		}

		if archivePath == "" || shouldSkipArchiveEntry(archivePath) {
			continue
		}

		relativePath, ok := trimArchiveRoot(archivePath, selectedRoot)
		if !ok || relativePath == "" {
			continue
		}

		targetPath := filepath.Join(destination, filepath.FromSlash(relativePath))
		insideDestination, err := isWithinBaseDir(destination, targetPath)
		if err != nil {
			return coreplugin.PluginManifest{}, "", err
		}

		if !insideDestination {
			return coreplugin.PluginManifest{}, "", coreplugin.ErrInvalidArchivePath
		}

		if file.Mode()&os.ModeSymlink != 0 {
			return coreplugin.PluginManifest{}, "", coreplugin.ErrInvalidArchivePath
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0755); err != nil {
				return coreplugin.PluginManifest{}, "", err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return coreplugin.PluginManifest{}, "", err
		}

		if err := writeZipFile(targetPath, file); err != nil {
			return coreplugin.PluginManifest{}, "", err
		}
	}

	manifestPath := filepath.Join(destination, manifestFile)
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return coreplugin.PluginManifest{}, "", coreplugin.ErrManifestNotFound
	}

	var manifest coreplugin.PluginManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return coreplugin.PluginManifest{}, "", coreplugin.ErrInvalidManifest
	}

	if err := validateManifest(manifest); err != nil {
		return coreplugin.PluginManifest{}, "", err
	}

	return manifest, destination, nil
}

func validateManifest(manifest coreplugin.PluginManifest) error {
	if strings.TrimSpace(manifest.ID) == "" {
		return coreplugin.ErrInvalidManifest
	}

	if strings.TrimSpace(manifest.Name) == "" {
		return coreplugin.ErrInvalidManifest
	}

	if strings.TrimSpace(manifest.Version) == "" {
		return coreplugin.ErrInvalidManifest
	}

	if strings.TrimSpace(manifest.Main) == "" {
		return coreplugin.ErrMainEntryMissing
	}

	if manifest.APIVersion != pluginAPIV4 {
		return &coreplugin.ErrUnsupportedAPIVersion{
			PluginID:   manifest.ID,
			APIVersion: manifest.APIVersion,
		}
	}

	return nil
}

func normalizeArchivePath(raw string) (string, error) {
	normalized := strings.ReplaceAll(strings.TrimSpace(raw), "\\", "/")
	normalized = strings.TrimPrefix(normalized, "./")
	if normalized == "" {
		return "", nil
	}

	clean := path.Clean(normalized)
	if clean == "." {
		return "", nil
	}

	if path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", coreplugin.ErrInvalidArchivePath
	}

	return clean, nil
}

func shouldSkipArchiveEntry(archivePath string) bool {
	return archivePath == "__MACOSX" ||
		strings.HasPrefix(archivePath, "__MACOSX/") ||
		path.Base(archivePath) == ".DS_Store"
}

func trimArchiveRoot(archivePath, root string) (string, bool) {
	if root == "" {
		return archivePath, true
	}

	if archivePath == root {
		return "", true
	}

	prefix := root + "/"
	if !strings.HasPrefix(archivePath, prefix) {
		return "", false
	}

	return strings.TrimPrefix(archivePath, prefix), true
}

func writeZipFile(targetPath string, file *zip.File) error {
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()

	writer, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer writer.Close()

	_, err = io.Copy(writer, reader)
	return err
}

func copyDir(sourceDir, targetDir string) error {
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return err
	}

	return filepath.WalkDir(sourceDir, func(currentPath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relativePath, err := filepath.Rel(sourceDir, currentPath)
		if err != nil {
			return err
		}

		if relativePath == "." {
			return nil
		}

		targetPath := filepath.Join(targetDir, relativePath)
		if entry.IsDir() {
			return os.MkdirAll(targetPath, 0755)
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}

		sourceFile, err := os.Open(currentPath)
		if err != nil {
			return err
		}

		info, err := entry.Info()
		if err != nil {
			sourceFile.Close()
			return err
		}

		targetFile, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode().Perm())
		if err != nil {
			sourceFile.Close()
			return err
		}

		if _, err := io.Copy(targetFile, sourceFile); err != nil {
			targetFile.Close()
			sourceFile.Close()
			return err
		}

		if err := sourceFile.Close(); err != nil {
			targetFile.Close()
			return err
		}

		return targetFile.Close()
	})
}

func isWithinBaseDir(baseDir, targetPath string) (bool, error) {
	absoluteBase, err := filepath.Abs(baseDir)
	if err != nil {
		return false, err
	}

	absoluteTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return false, err
	}

	relativePath, err := filepath.Rel(absoluteBase, absoluteTarget)
	if err != nil {
		return false, err
	}

	return relativePath == "." || (!strings.HasPrefix(relativePath, "..") && relativePath != ".."), nil
}
