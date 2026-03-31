package system

import (
	"os/exec"
	"path/filepath"
	"strings"
)

type processLaunchSpec struct {
	processPath string
	args        []string
	cmdLine     string
}

func resolveProcessLaunchSpec(commandName string, args []string, voltPath string) (processLaunchSpec, error) {
	processPath, err := resolveProcessPath(commandName, voltPath)
	if err != nil {
		return processLaunchSpec{}, err
	}

	return buildProcessLaunchSpec(processPath, args)
}

func resolveProcessPath(commandName string, voltPath string) (string, error) {
	if looksLikeProcessPath(commandName) {
		resolvedPath, err := exec.LookPath(resolveWorkspaceProcessPath(commandName, voltPath))
		if err != nil {
			return "", &ErrCommandNotFound{Command: commandName}
		}
		return resolvedPath, nil
	}

	processPath, err := exec.LookPath(commandName)
	if err != nil {
		return "", &ErrCommandNotFound{Command: commandName}
	}

	return processPath, nil
}

func looksLikeProcessPath(commandName string) bool {
	return strings.ContainsAny(commandName, `/\`) ||
		filepath.IsAbs(commandName) ||
		filepath.VolumeName(commandName) != ""
}

func resolveWorkspaceProcessPath(commandName string, voltPath string) string {
	normalized := filepath.Clean(strings.ReplaceAll(commandName, "/", string(filepath.Separator)))
	if filepath.IsAbs(normalized) || filepath.VolumeName(normalized) != "" {
		return normalized
	}

	return filepath.Join(voltPath, normalized)
}
