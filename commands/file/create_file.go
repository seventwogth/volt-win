package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const CreateFileName = "file.createFile"

type CreateFileRequest struct {
	VoltPath string
	FilePath string
	Content  string
}

type CreateFileResponse struct{}

type CreateFileCommand struct {
	repo domain.Repository
}

func NewCreateFileCommand(repo domain.Repository) *CreateFileCommand {
	return &CreateFileCommand{repo: repo}
}

func (c *CreateFileCommand) Name() string {
	return CreateFileName
}

func (c *CreateFileCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[CreateFileRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if err := c.repo.CreateFile(request.VoltPath, request.FilePath); err != nil {
		return nil, err
	}

	if request.Content == "" {
		return CreateFileResponse{}, nil
	}

	if err := c.repo.WriteFile(request.VoltPath, request.FilePath, request.Content); err != nil {
		return nil, err
	}

	return CreateFileResponse{}, nil
}
