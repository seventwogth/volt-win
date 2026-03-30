package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const CreateDirectoryName = "file.createDirectory"

type CreateDirectoryRequest struct {
	VoltPath string
	DirPath  string
}

type CreateDirectoryResponse struct{}

type CreateDirectoryCommand struct {
	repo domain.Repository
}

func NewCreateDirectoryCommand(repo domain.Repository) *CreateDirectoryCommand {
	return &CreateDirectoryCommand{repo: repo}
}

func (c *CreateDirectoryCommand) Name() string {
	return CreateDirectoryName
}

func (c *CreateDirectoryCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[CreateDirectoryRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if err := c.repo.CreateDirectory(request.VoltPath, request.DirPath); err != nil {
		return nil, err
	}

	return CreateDirectoryResponse{}, nil
}
