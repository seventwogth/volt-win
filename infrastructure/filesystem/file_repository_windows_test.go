//go:build windows

package filesystem

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	corefile "volt/core/file"
)

func TestFileRepositoryRejectsWindowsInvalidMutatingPaths(t *testing.T) {
	t.Parallel()

	repo := NewFileRepository()
	voltPath := t.TempDir()

	tests := []struct {
		name string
		err  error
	}{
		{
			name: "create file with reserved name",
			err:  repo.CreateFile(voltPath, "notes/CON.md"),
		},
		{
			name: "create directory with forbidden character",
			err:  repo.CreateDirectory(voltPath, "notes/illegal<name"),
		},
		{
			name: "delete path with trailing dot segment",
			err:  repo.DeletePath(voltPath, "notes/trailing./file.md"),
		},
		{
			name: "rename path to reserved name",
			err:  repo.RenamePath(voltPath, "notes/source.md", "notes/AUX.md"),
		},
		{
			name: "rename path from forbidden name",
			err:  repo.RenamePath(voltPath, "notes/bad|name.md", "notes/target.md"),
		},
	}

	for _, tt := range tests {
		if !errors.Is(tt.err, corefile.ErrInvalidName) {
			t.Fatalf("%s: error = %v, want ErrInvalidName", tt.name, tt.err)
		}
	}
}

func TestFileRepositoryRejectsWindowsInvalidPathsBeforeFilesystemAccess(t *testing.T) {
	t.Parallel()

	repo := NewFileRepository()
	voltPath := t.TempDir()

	if err := repo.WriteFile(voltPath, "notes/PRN.txt", "# invalid"); !errors.Is(err, corefile.ErrInvalidName) {
		t.Fatalf("WriteFile() error = %v, want ErrInvalidName", err)
	}

	if _, err := repo.ReadFile(voltPath, "notes/bad<name>.md"); !errors.Is(err, corefile.ErrInvalidName) {
		t.Fatalf("ReadFile() error = %v, want ErrInvalidName", err)
	}

	if _, err := repo.ListDirectory(voltPath, "notes/trailing. "); !errors.Is(err, corefile.ErrInvalidName) {
		t.Fatalf("ListDirectory() error = %v, want ErrInvalidName", err)
	}
}

func TestFileRepositoryDeletePathRemovesReadOnlyFile(t *testing.T) {
	t.Parallel()

	repo := NewFileRepository()
	voltPath := t.TempDir()

	filePath := filepath.Join(voltPath, "notes", "read-only.md")
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filePath, []byte("# readonly"), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if err := os.Chmod(filePath, 0444); err != nil {
		t.Fatalf("Chmod() error = %v", err)
	}

	if err := repo.DeletePath(voltPath, "notes/read-only.md"); err != nil {
		t.Fatalf("DeletePath() error = %v", err)
	}

	if _, err := os.Stat(filePath); !os.IsNotExist(err) {
		t.Fatalf("expected read-only file to be removed, stat error = %v", err)
	}
}

func TestFileRepositoryRenamePathAllowsReadOnlyFile(t *testing.T) {
	t.Parallel()

	repo := NewFileRepository()
	voltPath := t.TempDir()

	oldRelativePath := "notes/read-only.md"
	newRelativePath := "notes/renamed.md"
	oldFullPath := filepath.Join(voltPath, "notes", "read-only.md")
	newFullPath := filepath.Join(voltPath, "notes", "renamed.md")

	if err := repo.WriteFile(voltPath, oldRelativePath, "# readonly"); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if err := os.Chmod(oldFullPath, 0444); err != nil {
		t.Fatalf("Chmod() error = %v", err)
	}

	if err := repo.RenamePath(voltPath, oldRelativePath, newRelativePath); err != nil {
		t.Fatalf("RenamePath() error = %v", err)
	}

	if _, err := os.Stat(newFullPath); err != nil {
		t.Fatalf("expected renamed file to exist, stat error = %v", err)
	}
	if _, err := os.Stat(oldFullPath); !os.IsNotExist(err) {
		t.Fatalf("expected old path to be absent, stat error = %v", err)
	}
}
