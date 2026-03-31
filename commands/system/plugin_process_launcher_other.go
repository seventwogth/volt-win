//go:build !windows

package system

import "os/exec"

func buildProcessLaunchSpec(processPath string, args []string) (processLaunchSpec, error) {
	return processLaunchSpec{
		processPath: processPath,
		args:        args,
	}, nil
}

func configureProcessCommand(cmd *exec.Cmd, spec processLaunchSpec) {}
