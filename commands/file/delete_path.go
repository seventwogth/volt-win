package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const DeleteName = "file.delete"

type DeleteRequest struct {
	VoltPath string
	FilePath string
}

type DeleteResponse struct{}

type DeletePathCommand struct {
	repo domain.Repository
}

func NewDeleteCommand(repo domain.Repository) *DeletePathCommand {
	return &DeletePathCommand{repo: repo}
}

func (c *DeletePathCommand) Name() string {
	return DeleteName
}

func (c *DeletePathCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[DeleteRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if err := c.repo.DeletePath(request.VoltPath, request.FilePath); err != nil {
		return nil, err
	}

	return DeleteResponse{}, nil
}
