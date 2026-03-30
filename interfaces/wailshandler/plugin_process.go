package wailshandler

import (
	"context"
	"errors"
	"strings"

	commandbase "volt/commands"
	commandssystem "volt/commands/system"
)

func (h *PluginRuntimeHandler) StartPluginProcess(
	runID string,
	voltPath string,
	command string,
	args []string,
	stdin string,
	stdoutMode string,
	stderrMode string,
) error {
	normalizedCommand := strings.TrimSpace(command)
	_, err := commandbase.Execute[commandssystem.StartPluginProcessResponse](
		context.Background(),
		h.manager,
		commandssystem.StartPluginProcessName,
		commandssystem.StartPluginProcessRequest{
			RunID:               runID,
			VoltPath:            voltPath,
			Command:             command,
			Args:                args,
			Stdin:               stdin,
			StdoutMode:          stdoutMode,
			StderrMode:          stderrMode,
			StartFailedMessage:  translate(h.localization, "backend.error.process.startFailed", nil),
			StreamFailedMessage: translate(h.localization, "backend.error.process.streamFailed", nil),
			RunFailedMessage:    translate(h.localization, "backend.error.process.runFailed", nil),
		},
	)
	if err == nil {
		return nil
	}

	var commandNotFoundErr *commandssystem.ErrCommandNotFound
	if errors.As(err, &commandNotFoundErr) {
		commandName := normalizedCommand
		if commandName == "" {
			commandName = commandNotFoundErr.Command
		}
		return errors.New(translate(h.localization, "backend.error.process.commandNotFound", map[string]any{
			"command": commandName,
		}))
	}

	return localizedUnexpectedError(h.localization, "backend.action.startPluginProcess", nil, err)
}

func (h *PluginRuntimeHandler) CancelPluginProcess(runID string) error {
	_, err := commandbase.Execute[commandssystem.CancelPluginProcessResponse](
		context.Background(),
		h.manager,
		commandssystem.CancelPluginProcessName,
		commandssystem.CancelPluginProcessRequest{RunID: runID},
	)
	if err != nil {
		return localizedUnexpectedError(h.localization, "backend.action.cancelPluginProcess", nil, err)
	}

	return nil
}
