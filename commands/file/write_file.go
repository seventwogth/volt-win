package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const SaveName = "file.write"

type SaveRequest struct {
	VoltPath string
	FilePath string
	Content  string
}

type SaveResponse struct{}

type WriteFileCommand struct {
	repo domain.Repository
}

func NewSaveCommand(repo domain.Repository) *WriteFileCommand {
	return &WriteFileCommand{repo: repo}
}

func (c *WriteFileCommand) Name() string {
	return SaveName
}

func (c *WriteFileCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[SaveRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if err := c.repo.WriteFile(request.VoltPath, request.FilePath, request.Content); err != nil {
		return nil, err
	}

	return SaveResponse{}, nil
}
