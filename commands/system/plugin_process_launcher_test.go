package system

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveWorkspaceProcessPath(t *testing.T) {
	t.Parallel()

	voltPath := t.TempDir()
	got := resolveWorkspaceProcessPath(`tools/runner.cmd`, voltPath)
	want := filepath.Join(voltPath, "tools", "runner.cmd")
	if got != want {
		t.Fatalf("resolveWorkspaceProcessPath() = %q, want %q", got, want)
	}
}

func TestLooksLikeProcessPath(t *testing.T) {
	t.Parallel()

	if !looksLikeProcessPath(`tools\runner.cmd`) {
		t.Fatalf("expected command with separators to be treated as path")
	}

	if looksLikeProcessPath("git") {
		t.Fatalf("expected bare command to be treated as PATH lookup")
	}
}

func TestResolveProcessPathUsesWorkspaceForRelativeCommand(t *testing.T) {
	t.Parallel()

	voltPath := t.TempDir()
	commandPath := filepath.Join(voltPath, "tools", "runner.cmd")
	if err := os.MkdirAll(filepath.Dir(commandPath), 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(commandPath, []byte("@echo off\r\n"), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	resolvedPath, err := resolveProcessPath(`tools/runner`, voltPath)
	if err != nil {
		t.Fatalf("resolveProcessPath() error = %v", err)
	}

	if !strings.EqualFold(resolvedPath, commandPath) {
		t.Fatalf("resolveProcessPath() = %q, want %q", resolvedPath, commandPath)
	}
}
