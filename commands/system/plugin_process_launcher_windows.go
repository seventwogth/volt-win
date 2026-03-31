//go:build windows

package system

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func buildProcessLaunchSpec(processPath string, args []string) (processLaunchSpec, error) {
	switch strings.ToLower(filepath.Ext(processPath)) {
	case ".cmd", ".bat":
		cmdPath, err := resolveCommandInterpreterPath()
		if err != nil {
			return processLaunchSpec{}, &ErrCommandNotFound{Command: "cmd.exe"}
		}

		return processLaunchSpec{
			processPath: cmdPath,
			cmdLine:     buildBatchCommandLine(cmdPath, processPath, args),
		}, nil
	default:
		return processLaunchSpec{
			processPath: processPath,
			args:        args,
		}, nil
	}
}

func configureProcessCommand(cmd *exec.Cmd, spec processLaunchSpec) {
	if spec.cmdLine == "" {
		return
	}

	cmd.Args = nil
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.CmdLine = spec.cmdLine
}

func resolveCommandInterpreterPath() (string, error) {
	if comSpec := strings.TrimSpace(os.Getenv("ComSpec")); comSpec != "" {
		return exec.LookPath(comSpec)
	}

	return exec.LookPath("cmd.exe")
}

func buildBatchCommandLine(cmdPath string, processPath string, args []string) string {
	tokens := []string{
		syscall.EscapeArg(cmdPath),
		"/d",
		"/c",
	}
	tokens = append(tokens, quoteBatchArgument(processPath))
	for _, arg := range args {
		tokens = append(tokens, escapeBatchArgument(arg))
	}

	return strings.Join(tokens, " ")
}

func escapeBatchArgument(value string) string {
	if value == "" {
		return `""`
	}

	escaped := strings.ReplaceAll(value, "^", "^^")
	escaped = strings.ReplaceAll(escaped, "%", "%%")
	escaped = strings.ReplaceAll(escaped, "!", "^!")
	escaped = strings.ReplaceAll(escaped, `"`, `^"`)

	if strings.ContainsAny(value, " \t\"&|<>()^%!") {
		return quoteBatchArgument(escaped)
	}

	return escaped
}

func quoteBatchArgument(value string) string {
	return `"` + value + `"`
}
