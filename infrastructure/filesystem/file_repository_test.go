package filesystem

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFileRepositorySupportsBackslashRelativePaths(t *testing.T) {
	t.Parallel()

	repo := NewFileRepository()
	voltPath := t.TempDir()

	if err := repo.WriteFile(voltPath, `notes\idea.md`, "# idea"); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	fullPath := filepath.Join(voltPath, "notes", "idea.md")
	if _, err := os.Stat(fullPath); err != nil {
		t.Fatalf("expected %q to exist: %v", fullPath, err)
	}

	content, err := repo.ReadFile(voltPath, "notes/idea.md")
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if content != "# idea" {
		t.Fatalf("ReadFile() = %q, want %q", content, "# idea")
	}
}

func TestFileRepositoryListDirectoryNormalizesReturnedPaths(t *testing.T) {
	t.Parallel()

	repo := NewFileRepository()
	voltPath := t.TempDir()

	filePath := filepath.Join(voltPath, "notes", "daily", "log.md")
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filePath, []byte("# log"), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	entries, err := repo.ListDirectory(voltPath, `notes\daily`)
	if err != nil {
		t.Fatalf("ListDirectory() error = %v", err)
	}

	if len(entries) != 1 {
		t.Fatalf("ListDirectory() returned %d entries, want 1", len(entries))
	}

	if entries[0].Path != "notes/daily/log.md" {
		t.Fatalf("entries[0].Path = %q, want %q", entries[0].Path, "notes/daily/log.md")
	}
}
