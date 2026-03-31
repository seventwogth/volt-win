package settings

import (
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

//go:embed locales/*.json
var builtinLocalesFS embed.FS

const (
	builtinLocaleSource = "builtin"
	customLocaleSource  = "custom"
	fallbackLocaleCode  = "en"
)

type localeFile struct {
	Label    string            `json:"label"`
	Messages map[string]string `json:"messages"`
}

type localeCatalog struct {
	Label    string
	Messages map[string]string
	Source   string
}

type LocalizationService struct {
	settingsRepo Repository
	localeDir    string

	mu      sync.RWMutex
	current LocalizationPayload
}

func NewLocalizationService(settingsRepo Repository, localeDir string) (*LocalizationService, error) {
	if err := os.MkdirAll(localeDir, 0755); err != nil {
		return nil, err
	}

	service := &LocalizationService{
		settingsRepo: settingsRepo,
		localeDir:    localeDir,
	}

	payload, err := service.resolveCurrent(nil)
	if err != nil {
		return nil, err
	}
	service.setCurrent(payload)

	return service, nil
}

func (s *LocalizationService) GetLocalization(preferredLocales []string) (LocalizationPayload, error) {
	payload, err := s.resolveCurrent(preferredLocales)
	if err != nil {
		return LocalizationPayload{}, err
	}

	s.setCurrent(payload)
	return cloneLocalizationPayload(payload), nil
}

func (s *LocalizationService) SetLocale(locale string, preferredLocales []string) (LocalizationPayload, error) {
	current, err := s.settingsRepo.Get()
	if err != nil {
		return LocalizationPayload{}, err
	}

	current.Locale = normalizeSelectedLocale(locale)
	if err := s.settingsRepo.Save(current); err != nil {
		return LocalizationPayload{}, err
	}

	payload, err := s.resolveCurrent(preferredLocales)
	if err != nil {
		return LocalizationPayload{}, err
	}

	s.setCurrent(payload)
	return cloneLocalizationPayload(payload), nil
}

func (s *LocalizationService) Translate(key string, params map[string]any) string {
	s.mu.RLock()
	messages := s.current.Messages
	s.mu.RUnlock()

	message := messages[key]
	if message == "" {
		message = key
	}

	return interpolate(message, params)
}

func (s *LocalizationService) resolveCurrent(preferredLocales []string) (LocalizationPayload, error) {
	current, err := s.settingsRepo.Get()
	if err != nil {
		return LocalizationPayload{}, err
	}

	selectedLocale := normalizeSelectedLocale(current.Locale)
	catalogs, err := s.loadCatalogs()
	if err != nil {
		return LocalizationPayload{}, err
	}

	effectiveLocale := resolveEffectiveLocale(selectedLocale, preferredLocales, catalogs)
	effectiveMessages := cloneMessages(catalogs[fallbackLocaleCode].Messages)
	if catalog, ok := catalogs[effectiveLocale]; ok {
		mergeMessages(effectiveMessages, catalog.Messages)
	}

	return LocalizationPayload{
		SelectedLocale:   selectedLocale,
		EffectiveLocale:  effectiveLocale,
		AvailableLocales: buildAvailableLocales(catalogs),
		Messages:         effectiveMessages,
	}, nil
}

func (s *LocalizationService) loadCatalogs() (map[string]localeCatalog, error) {
	catalogs, err := loadBuiltinCatalogs()
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(s.localeDir)
	if err != nil {
		if os.IsNotExist(err) {
			return catalogs, nil
		}
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		code := normalizeLocaleCode(strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())))
		if code == "" {
			continue
		}

		raw, err := os.ReadFile(filepath.Join(s.localeDir, entry.Name()))
		if err != nil {
			log.Printf("failed to read custom locale %s: %v", entry.Name(), err)
			continue
		}

		var file localeFile
		if err := json.Unmarshal(raw, &file); err != nil {
			log.Printf("invalid custom locale %s: %v", entry.Name(), err)
			continue
		}

		file.Messages = cloneMessages(file.Messages)

		if existing, ok := catalogs[code]; ok {
			merged := cloneMessages(existing.Messages)
			mergeMessages(merged, file.Messages)
			label := existing.Label
			if strings.TrimSpace(file.Label) != "" {
				label = strings.TrimSpace(file.Label)
			}

			catalogs[code] = localeCatalog{
				Label:    label,
				Messages: merged,
				Source:   customLocaleSource,
			}
			continue
		}

		label := strings.TrimSpace(file.Label)
		if label == "" {
			label = code
		}

		catalogs[code] = localeCatalog{
			Label:    label,
			Messages: file.Messages,
			Source:   customLocaleSource,
		}
	}

	return catalogs, nil
}

func loadBuiltinCatalogs() (map[string]localeCatalog, error) {
	entries, err := builtinLocalesFS.ReadDir("locales")
	if err != nil {
		return nil, err
	}

	catalogs := make(map[string]localeCatalog, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		code := normalizeLocaleCode(strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())))
		if code == "" {
			continue
		}

		raw, err := builtinLocalesFS.ReadFile(path.Join("locales", entry.Name()))
		if err != nil {
			return nil, err
		}

		var file localeFile
		if err := json.Unmarshal(raw, &file); err != nil {
			return nil, fmt.Errorf("invalid builtin locale %s: %w", entry.Name(), err)
		}

		label := strings.TrimSpace(file.Label)
		if label == "" {
			label = code
		}

		catalogs[code] = localeCatalog{
			Label:    label,
			Messages: cloneMessages(file.Messages),
			Source:   builtinLocaleSource,
		}
	}

	if _, ok := catalogs[fallbackLocaleCode]; !ok {
		return nil, fmt.Errorf("missing builtin fallback locale %q", fallbackLocaleCode)
	}

	return catalogs, nil
}

func resolveEffectiveLocale(selectedLocale string, preferredLocales []string, catalogs map[string]localeCatalog) string {
	if selectedLocale != AutoLocale {
		if _, ok := catalogs[selectedLocale]; ok {
			return selectedLocale
		}
	}

	for _, preferred := range preferredLocales {
		normalized := normalizeLocaleCode(preferred)
		if normalized == "" {
			continue
		}

		if _, ok := catalogs[normalized]; ok {
			return normalized
		}

		base := normalized
		if idx := strings.Index(base, "-"); idx != -1 {
			base = base[:idx]
		}
		if _, ok := catalogs[base]; ok {
			return base
		}
	}

	return fallbackLocaleCode
}

func buildAvailableLocales(catalogs map[string]localeCatalog) []AvailableLocale {
	codes := make([]string, 0, len(catalogs))
	for code := range catalogs {
		codes = append(codes, code)
	}

	sort.Slice(codes, func(i, j int) bool {
		left := localeSortRank(codes[i])
		right := localeSortRank(codes[j])
		if left != right {
			return left < right
		}
		return codes[i] < codes[j]
	})

	available := make([]AvailableLocale, 0, len(codes))
	for _, code := range codes {
		catalog := catalogs[code]
		available = append(available, AvailableLocale{
			Code:   code,
			Label:  catalog.Label,
			Source: catalog.Source,
		})
	}

	return available
}

func localeSortRank(code string) int {
	switch code {
	case "en":
		return 0
	case "ru":
		return 1
	default:
		return 2
	}
}

func normalizeSelectedLocale(locale string) string {
	normalized := normalizeLocaleCode(locale)
	if normalized == "" {
		return AutoLocale
	}
	return normalized
}

func normalizeLocaleCode(locale string) string {
	normalized := strings.ToLower(strings.TrimSpace(locale))
	normalized = strings.ReplaceAll(normalized, "_", "-")
	if normalized == "" {
		return ""
	}
	return normalized
}

func cloneMessages(messages map[string]string) map[string]string {
	if len(messages) == 0 {
		return map[string]string{}
	}

	cloned := make(map[string]string, len(messages))
	for key, value := range messages {
		cloned[key] = value
	}
	return cloned
}

func mergeMessages(target map[string]string, source map[string]string) {
	for key, value := range source {
		target[key] = value
	}
}

func interpolate(message string, params map[string]any) string {
	if len(params) == 0 {
		return message
	}

	result := message
	for key, value := range params {
		result = strings.ReplaceAll(result, "{"+key+"}", fmt.Sprint(value))
	}

	return result
}

func cloneLocalizationPayload(payload LocalizationPayload) LocalizationPayload {
	clonedAvailable := make([]AvailableLocale, len(payload.AvailableLocales))
	copy(clonedAvailable, payload.AvailableLocales)

	return LocalizationPayload{
		SelectedLocale:   payload.SelectedLocale,
		EffectiveLocale:  payload.EffectiveLocale,
		AvailableLocales: clonedAvailable,
		Messages:         cloneMessages(payload.Messages),
	}
}

func (s *LocalizationService) setCurrent(payload LocalizationPayload) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.current = cloneLocalizationPayload(payload)
}
