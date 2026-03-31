package filesystem

import (
	"path/filepath"
	"strings"
)

func IsWithinBaseDir(baseDir, targetPath string) (bool, error) {
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
