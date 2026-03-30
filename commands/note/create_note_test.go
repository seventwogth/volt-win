package note

import (
	"context"
	"testing"

	corefile "volt/core/file"
)

type createNoteRepoStub struct {
	createdPath string
}

func (s *createNoteRepoStub) ReadFile(_ string, _ string) (string, error) {
	return "", nil
}

func (s *createNoteRepoStub) WriteFile(_ string, _, _ string) error {
	return nil
}

func (s *createNoteRepoStub) ListDirectory(_ string, _ string) ([]corefile.FileEntry, error) {
	return nil, nil
}

func (s *createNoteRepoStub) CreateFile(_ string, filePath string) error {
	s.createdPath = filePath
	return nil
}

func (s *createNoteRepoStub) CreateDirectory(_ string, _ string) error {
	return nil
}

func (s *createNoteRepoStub) DeletePath(_ string, _ string) error {
	return nil
}

func (s *createNoteRepoStub) RenamePath(_ string, _, _ string) error {
	return nil
}

func TestCreateNoteCommandNormalizesMarkdownExtension(t *testing.T) {
	repo := &createNoteRepoStub{}

	command := NewCreateNoteCommand(repo)
	resultRaw, err := command.Execute(context.Background(), CreateNoteRequest{
		VoltPath: "/tmp/volt",
		FilePath: "notes/project-plan",
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	if repo.createdPath != "notes/project-plan.md" {
		t.Fatalf("createdPath = %q, want %q", repo.createdPath, "notes/project-plan.md")
	}

	result, ok := resultRaw.(CreateNoteResponse)
	if !ok {
		t.Fatalf("unexpected response type %T", resultRaw)
	}

	if result.Note.Path != "notes/project-plan.md" {
		t.Fatalf("note path = %q, want %q", result.Note.Path, "notes/project-plan.md")
	}

	if result.Note.Name != "project-plan.md" {
		t.Fatalf("note name = %q, want %q", result.Note.Name, "project-plan.md")
	}
}
