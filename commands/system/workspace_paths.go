package system

import (
	"fmt"
	"path/filepath"
	"strings"

	"volt/infrastructure/filesystem"
)

func normalizeWorkspaceSubdir(raw string, fallback string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return fallback, nil
	}

	normalized := filesystem.NormalizeWorkspacePath(trimmed)
	if normalized == "" || normalized == "." {
		return fallback, nil
	}

	if isAbsoluteWorkspacePath(trimmed) || normalized == ".." || strings.HasPrefix(normalized, "../") {
		return "", fmt.Errorf("invalid target dir")
	}

	return normalized, nil
}

func isAbsoluteWorkspacePath(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}

	if filepath.IsAbs(trimmed) {
		return true
	}

	slashed := strings.ReplaceAll(trimmed, "\\", "/")
	if strings.HasPrefix(slashed, "/") || strings.HasPrefix(slashed, "//") {
		return true
	}

	if len(slashed) >= 2 && slashed[1] == ':' {
		drive := slashed[0]
		if (drive >= 'a' && drive <= 'z') || (drive >= 'A' && drive <= 'Z') {
			return true
		}
	}

	return false
}
