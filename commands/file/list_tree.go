package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const ListTreeName = "file.listTree"

type ListTreeRequest struct {
	VoltPath string
	DirPath  string
}

type ListTreeResponse struct {
	Entries []domain.FileEntry
}

type ListTreeCommand struct {
	repo domain.Repository
}

func NewListTreeCommand(repo domain.Repository) *ListTreeCommand {
	return &ListTreeCommand{repo: repo}
}

func (c *ListTreeCommand) Name() string {
	return ListTreeName
}

func (c *ListTreeCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[ListTreeRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	entries, err := c.repo.ListDirectory(request.VoltPath, request.DirPath)
	if err != nil {
		return nil, err
	}

	return ListTreeResponse{Entries: entries}, nil
}
