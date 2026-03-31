package system

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"

	commandbase "volt/commands"
)

const (
	pluginProcessEventName  = "volt:plugin-process"
	StartPluginProcessName  = "system.process.startPlugin"
	CancelPluginProcessName = "system.process.cancelPlugin"
)

type PluginProcessRuntimeEvent struct {
	RunID   string `json:"runId"`
	Type    string `json:"type"`
	Data    string `json:"data,omitempty"`
	Code    int    `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}

type StartPluginProcessRequest struct {
	RunID               string
	VoltPath            string
	Command             string
	Args                []string
	Stdin               string
	StdoutMode          string
	StderrMode          string
	StartFailedMessage  string
	StreamFailedMessage string
	RunFailedMessage    string
}

type StartPluginProcessResponse struct{}

type CancelPluginProcessRequest struct {
	RunID string
}

type CancelPluginProcessResponse struct{}

type PluginProcessService struct {
	runtime        Runtime
	processMu      sync.Mutex
	processCancels map[string]context.CancelFunc
}

func NewPluginProcessService(runtime Runtime) *PluginProcessService {
	return &PluginProcessService{
		runtime:        runtime,
		processCancels: make(map[string]context.CancelFunc),
	}
}

func (s *PluginProcessService) Start(req StartPluginProcessRequest) error {
	appCtx := s.runtime.Context()
	if appCtx == nil {
		return ErrRuntimeNotReady
	}

	runID := strings.TrimSpace(req.RunID)
	if runID == "" {
		return ErrRunIDRequired
	}

	voltPath := strings.TrimSpace(req.VoltPath)
	if voltPath == "" {
		return ErrWorkspacePathRequired
	}

	commandName := strings.TrimSpace(req.Command)
	if commandName == "" {
		return ErrCommandRequired
	}

	launchSpec, err := resolveProcessLaunchSpec(commandName, req.Args, voltPath)
	if err != nil {
		return err
	}

	s.processMu.Lock()
	if _, exists := s.processCancels[runID]; exists {
		s.processMu.Unlock()
		return &ErrProcessRunExists{RunID: runID}
	}

	runCtx, cancel := context.WithCancel(appCtx)
	s.processCancels[runID] = cancel
	s.processMu.Unlock()

	go s.run(
		runCtx,
		cancel,
		launchSpec,
		runID,
		voltPath,
		req.Stdin,
		normalizeProcessMode(req.StdoutMode),
		normalizeProcessMode(req.StderrMode),
		req.StartFailedMessage,
		req.StreamFailedMessage,
		req.RunFailedMessage,
	)

	return nil
}

func (s *PluginProcessService) Cancel(runID string) {
	normalizedRunID := strings.TrimSpace(runID)
	if normalizedRunID == "" {
		return
	}

	cancel, ok := s.consumeProcessCancel(normalizedRunID)
	if ok {
		cancel()
	}
}

func (s *PluginProcessService) run(
	runCtx context.Context,
	cancel context.CancelFunc,
	launchSpec processLaunchSpec,
	runID string,
	voltPath string,
	stdin string,
	stdoutMode string,
	stderrMode string,
	startFailedMessage string,
	streamFailedMessage string,
	runFailedMessage string,
) {
	defer s.consumeProcessCancel(runID)

	cmd := exec.CommandContext(runCtx, launchSpec.processPath, launchSpec.args...)
	configureProcessCommand(cmd, launchSpec)
	cmd.Dir = voltPath
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "error", Message: startFailedMessage})
		return
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "error", Message: startFailedMessage})
		return
	}

	if err := cmd.Start(); err != nil {
		s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "error", Message: startFailedMessage})
		return
	}

	streamErrors := make(chan error, 2)
	var streamWG sync.WaitGroup
	streamWG.Add(2)

	go func() {
		defer streamWG.Done()
		if streamErr := s.streamOutput(runCtx, runID, "stdout", stdout, stdoutMode); streamErr != nil {
			select {
			case streamErrors <- streamErr:
			default:
			}
			cancel()
		}
	}()

	go func() {
		defer streamWG.Done()
		if streamErr := s.streamOutput(runCtx, runID, "stderr", stderr, stderrMode); streamErr != nil {
			select {
			case streamErrors <- streamErr:
			default:
			}
			cancel()
		}
	}()

	waitErr := cmd.Wait()
	streamWG.Wait()
	close(streamErrors)

	if streamErr := firstStreamError(streamErrors); streamErr != nil {
		if !errors.Is(runCtx.Err(), context.Canceled) {
			s.runtime.LogError(s.runtime.Context(), fmt.Sprintf("plugin process %s stream failed: %v", runID, streamErr))
			s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "error", Message: streamFailedMessage})
		}
		return
	}

	if errors.Is(runCtx.Err(), context.Canceled) {
		return
	}

	if waitErr != nil {
		var exitErr *exec.ExitError
		if errors.As(waitErr, &exitErr) {
			s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "exit", Code: exitErr.ExitCode()})
			return
		}

		s.runtime.LogError(s.runtime.Context(), fmt.Sprintf("plugin process %s failed: %v", runID, waitErr))
		s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "error", Message: runFailedMessage})
		return
	}

	s.emitEvent(PluginProcessRuntimeEvent{RunID: runID, Type: "exit", Code: 0})
}

func (s *PluginProcessService) streamOutput(
	runCtx context.Context,
	runID string,
	eventType string,
	reader io.Reader,
	mode string,
) error {
	switch mode {
	case "lines":
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			select {
			case <-runCtx.Done():
				return nil
			default:
			}

			s.emitEvent(PluginProcessRuntimeEvent{
				RunID: runID,
				Type:  eventType,
				Data:  scanner.Text(),
			})
		}

		if err := scanner.Err(); err != nil && !errors.Is(runCtx.Err(), context.Canceled) {
			return err
		}
		return nil
	default:
		buffer := make([]byte, 4096)
		for {
			count, err := reader.Read(buffer)
			if count > 0 {
				s.emitEvent(PluginProcessRuntimeEvent{
					RunID: runID,
					Type:  eventType,
					Data:  string(buffer[:count]),
				})
			}

			if err != nil {
				if errors.Is(err, io.EOF) || errors.Is(runCtx.Err(), context.Canceled) {
					return nil
				}
				return err
			}
		}
	}
}

func (s *PluginProcessService) emitEvent(payload PluginProcessRuntimeEvent) {
	runtimeCtx := s.runtime.Context()
	if runtimeCtx == nil {
		return
	}

	s.runtime.EventsEmit(runtimeCtx, pluginProcessEventName, payload)
}

func (s *PluginProcessService) consumeProcessCancel(runID string) (context.CancelFunc, bool) {
	s.processMu.Lock()
	defer s.processMu.Unlock()

	cancel, ok := s.processCancels[runID]
	if ok {
		delete(s.processCancels, runID)
	}

	return cancel, ok
}

func normalizeProcessMode(mode string) string {
	if strings.EqualFold(strings.TrimSpace(mode), "lines") {
		return "lines"
	}

	return "raw"
}

func firstStreamError(streamErrors <-chan error) error {
	for err := range streamErrors {
		if err != nil {
			return err
		}
	}

	return nil
}

type StartPluginProcessCommand struct {
	service *PluginProcessService
}

func NewStartPluginProcessCommand(service *PluginProcessService) *StartPluginProcessCommand {
	return &StartPluginProcessCommand{service: service}
}

func (c *StartPluginProcessCommand) Name() string {
	return StartPluginProcessName
}

func (c *StartPluginProcessCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[StartPluginProcessRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if err := c.service.Start(request); err != nil {
		return nil, err
	}

	return StartPluginProcessResponse{}, nil
}

type CancelPluginProcessCommand struct {
	service *PluginProcessService
}

func NewCancelPluginProcessCommand(service *PluginProcessService) *CancelPluginProcessCommand {
	return &CancelPluginProcessCommand{service: service}
}

func (c *CancelPluginProcessCommand) Name() string {
	return CancelPluginProcessName
}

func (c *CancelPluginProcessCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[CancelPluginProcessRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	c.service.Cancel(request.RunID)
	return CancelPluginProcessResponse{}, nil
}
