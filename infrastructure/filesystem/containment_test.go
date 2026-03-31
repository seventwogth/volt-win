package filesystem

import (
	"path/filepath"
	"testing"
)

func TestIsWithinBaseDir(t *testing.T) {
	t.Parallel()

	baseDir := t.TempDir()
	insidePath := filepath.Join(baseDir, "notes", "idea.md")
	outsidePath := filepath.Join(filepath.Dir(baseDir), "other", "idea.md")

	inside, err := IsWithinBaseDir(baseDir, insidePath)
	if err != nil {
		t.Fatalf("IsWithinBaseDir(inside) error = %v", err)
	}
	if !inside {
		t.Fatalf("expected inside path to be allowed")
	}

	outside, err := IsWithinBaseDir(baseDir, outsidePath)
	if err != nil {
		t.Fatalf("IsWithinBaseDir(outside) error = %v", err)
	}
	if outside {
		t.Fatalf("expected outside path to be rejected")
	}
}
