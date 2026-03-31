//go:build windows

package system

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveProcessLaunchSpecWrapsBatchFilesWithCmd(t *testing.T) {
	t.Parallel()

	voltPath := t.TempDir()
	commandPath := filepath.Join(voltPath, "tools", "runner.cmd")
	if err := os.MkdirAll(filepath.Dir(commandPath), 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(commandPath, []byte("@echo off\r\n"), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	spec, err := resolveProcessLaunchSpec(`tools/runner`, []string{"arg 1", "100%"}, voltPath)
	if err != nil {
		t.Fatalf("resolveProcessLaunchSpec() error = %v", err)
	}

	if !strings.EqualFold(filepath.Base(spec.processPath), "cmd.exe") {
		t.Fatalf("spec.processPath = %q, want cmd.exe launcher", spec.processPath)
	}

	if spec.cmdLine == "" {
		t.Fatalf("expected batch launch to use custom cmd line")
	}

	if !strings.Contains(spec.cmdLine, `"`+commandPath+`"`) {
		t.Fatalf("cmdLine = %q, want quoted batch path", spec.cmdLine)
	}

	if !strings.Contains(spec.cmdLine, `"arg 1"`) {
		t.Fatalf("cmdLine = %q, want quoted spaced arg", spec.cmdLine)
	}

	if !strings.Contains(spec.cmdLine, `"100%%"`) {
		t.Fatalf("cmdLine = %q, want escaped percent arg", spec.cmdLine)
	}
}

func TestResolveProcessLaunchSpecKeepsExecutablesDirect(t *testing.T) {
	t.Parallel()

	voltPath := t.TempDir()
	commandPath := filepath.Join(voltPath, "tools", "runner.exe")
	if err := os.MkdirAll(filepath.Dir(commandPath), 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(commandPath, []byte(""), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	spec, err := resolveProcessLaunchSpec(`tools/runner`, []string{"--flag"}, voltPath)
	if err != nil {
		t.Fatalf("resolveProcessLaunchSpec() error = %v", err)
	}

	if !strings.EqualFold(spec.processPath, commandPath) {
		t.Fatalf("spec.processPath = %q, want %q", spec.processPath, commandPath)
	}

	if spec.cmdLine != "" {
		t.Fatalf("expected executable launch to avoid custom cmd line, got %q", spec.cmdLine)
	}

	if len(spec.args) != 1 || spec.args[0] != "--flag" {
		t.Fatalf("spec.args = %#v, want %#v", spec.args, []string{"--flag"})
	}
}
