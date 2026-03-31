package filesystem

import (
	"strings"

	corefile "volt/core/file"
)

var windowsReservedNames = map[string]struct{}{
	"CON":  {},
	"PRN":  {},
	"AUX":  {},
	"NUL":  {},
	"COM1": {},
	"COM2": {},
	"COM3": {},
	"COM4": {},
	"COM5": {},
	"COM6": {},
	"COM7": {},
	"COM8": {},
	"COM9": {},
	"LPT1": {},
	"LPT2": {},
	"LPT3": {},
	"LPT4": {},
	"LPT5": {},
	"LPT6": {},
	"LPT7": {},
	"LPT8": {},
	"LPT9": {},
}

func validateWorkspacePath(relativePath string, allowEmpty bool) error {
	if NormalizeWorkspacePath(relativePath) == "" {
		if allowEmpty {
			return nil
		}
		return corefile.ErrInvalidName
	}

	for _, segment := range strings.Split(strings.ReplaceAll(relativePath, "\\", "/"), "/") {
		if segment == "" || segment == "." || segment == ".." {
			continue
		}

		if err := validateWindowsPathSegment(segment); err != nil {
			return err
		}
	}

	return nil
}

func validateWorkspacePathForMutation(relativePath string) error {
	return validateWorkspacePath(relativePath, false)
}

func validateWindowsPathSegment(segment string) error {
	if segment == "" {
		return corefile.ErrInvalidName
	}

	if strings.ContainsAny(segment, `<>:"|?*`) {
		return corefile.ErrInvalidName
	}

	if strings.HasSuffix(segment, " ") || strings.HasSuffix(segment, ".") {
		return corefile.ErrInvalidName
	}

	if isWindowsReservedName(segment) {
		return corefile.ErrInvalidName
	}

	return nil
}

func isWindowsReservedName(segment string) bool {
	trimmed := strings.TrimRight(segment, " .")
	if trimmed == "" {
		return false
	}

	base := trimmed
	if dot := strings.IndexByte(base, '.'); dot >= 0 {
		base = base[:dot]
	}

	if base == "" {
		return false
	}

	_, ok := windowsReservedNames[strings.ToUpper(base)]
	return ok
}
