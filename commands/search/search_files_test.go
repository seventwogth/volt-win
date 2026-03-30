package search

import (
	"context"
	"testing"

	corefile "volt/core/file"
)

type searchRepoStub struct {
	tree  []corefile.FileEntry
	files map[string]string
}

func (s *searchRepoStub) ReadFile(_ string, filePath string) (string, error) {
	return s.files[filePath], nil
}

func (s *searchRepoStub) WriteFile(_ string, filePath, content string) error {
	s.files[filePath] = content
	return nil
}

func (s *searchRepoStub) ListDirectory(_ string, _ string) ([]corefile.FileEntry, error) {
	return s.tree, nil
}

func (s *searchRepoStub) CreateFile(_ string, _ string) error {
	return nil
}

func (s *searchRepoStub) CreateDirectory(_ string, _ string) error {
	return nil
}

func (s *searchRepoStub) DeletePath(_ string, _ string) error {
	return nil
}

func (s *searchRepoStub) RenamePath(_ string, _, _ string) error {
	return nil
}

func TestSearchFilesCommandIndexesMarkdownOnly(t *testing.T) {
	repo := &searchRepoStub{
		tree: []corefile.FileEntry{
			{Name: "idea.md", Path: "notes/idea.md", IsDir: false},
			{Name: "roadmap.board", Path: "boards/roadmap.board", IsDir: false},
		},
		files: map[string]string{
			"notes/idea.md":      "ship boards soon",
			"boards/roadmap.board": `{"elements":[{"text":"ship boards soon"}]}`,
		},
	}

	command := NewSearchFilesCommand(repo)
	resultRaw, err := command.Execute(context.Background(), SearchFilesRequest{
		VoltPath: "/tmp/volt",
		Query:    "boards",
	})
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}

	result, ok := resultRaw.(SearchFilesResponse)
	if !ok {
		t.Fatalf("unexpected response type %T", resultRaw)
	}

	if len(result.Results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(result.Results))
	}

	if result.Results[0].FilePath != "notes/idea.md" {
		t.Fatalf("result path = %q, want %q", result.Results[0].FilePath, "notes/idea.md")
	}
}
