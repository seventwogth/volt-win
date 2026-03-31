package filesystem

import (
	"path"
	"strings"
)

// NormalizeWorkspacePath converts relative workspace paths to a stable slash-based format
// used between backend and frontend, regardless of the host OS.
func NormalizeWorkspacePath(value string) string {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), "\\", "/")
	if normalized == "" {
		return ""
	}

	clean := path.Clean(normalized)
	if clean == "." {
		return ""
	}

	return strings.TrimPrefix(clean, "./")
}

func JoinWorkspacePath(parts ...string) string {
	normalizedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		normalized := NormalizeWorkspacePath(part)
		if normalized == "" {
			continue
		}
		normalizedParts = append(normalizedParts, normalized)
	}

	if len(normalizedParts) == 0 {
		return ""
	}

	joined := path.Join(normalizedParts...)
	if joined == "." {
		return ""
	}

	return joined
}

func WorkspaceBase(value string) string {
	normalized := NormalizeWorkspacePath(value)
	if normalized == "" {
		return ""
	}

	return path.Base(normalized)
}
