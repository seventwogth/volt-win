package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const ReadName = "file.read"

type ReadRequest struct {
	VoltPath string
	FilePath string
}

type ReadResponse struct {
	Content string
}

type ReadFileCommand struct {
	repo domain.Repository
}

func NewReadCommand(repo domain.Repository) *ReadFileCommand {
	return &ReadFileCommand{repo: repo}
}

func (c *ReadFileCommand) Name() string {
	return ReadName
}

func (c *ReadFileCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[ReadRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	content, err := c.repo.ReadFile(request.VoltPath, request.FilePath)
	if err != nil {
		return nil, err
	}

	return ReadResponse{Content: content}, nil
}
