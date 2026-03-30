package file

import (
	"context"
	"testing"

	domain "volt/core/file"
)

type renameRepoStub struct {
	files       map[string]string
	renamedFrom string
	renamedTo   string
}

func (s *renameRepoStub) ReadFile(_ string, filePath string) (string, error) {
	return s.files[filePath], nil
}

func (s *renameRepoStub) WriteFile(_ string, filePath, content string) error {
	s.files[filePath] = content
	return nil
}

func (s *renameRepoStub) ListDirectory(_ string, _ string) ([]domain.FileEntry, error) {
	return nil, nil
}

func (s *renameRepoStub) CreateFile(_ string, _ string) error {
	return nil
}

func (s *renameRepoStub) CreateDirectory(_ string, _ string) error {
	return nil
}

func (s *renameRepoStub) DeletePath(_ string, _ string) error {
	return nil
}

func (s *renameRepoStub) RenamePath(_ string, oldPath, newPath string) error {
	s.renamedFrom = oldPath
	s.renamedTo = newPath
	if content, ok := s.files[oldPath]; ok {
		delete(s.files, oldPath)
		s.files[newPath] = content
	}
	return nil
}

func TestRenameCommandRenamesRequestedPath(t *testing.T) {
	repo := &renameRepoStub{
		files: map[string]string{
			"notes/idea.md": "# idea",
		},
	}

	command := NewRenameCommand(repo)
	_, err := command.Execute(context.Background(), RenameRequest{
		VoltPath: "/tmp/volt",
		OldPath:  "notes/idea.md",
		NewPath:  "notes/renamed.md",
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if repo.renamedFrom != "notes/idea.md" || repo.renamedTo != "notes/renamed.md" {
		t.Fatalf("rename called with %q -> %q", repo.renamedFrom, repo.renamedTo)
	}

	if _, exists := repo.files["notes/idea.md"]; exists {
		t.Fatalf("expected old path to be removed after rename")
	}

	if repo.files["notes/renamed.md"] != "# idea" {
		t.Fatalf("renamed content = %q, want %q", repo.files["notes/renamed.md"], "# idea")
	}
}
