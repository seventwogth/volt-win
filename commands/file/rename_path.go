package file

import (
	"context"

	commandbase "volt/commands"
	domain "volt/core/file"
)

const RenameName = "file.rename"

type RenameRequest struct {
	VoltPath string
	OldPath  string
	NewPath  string
}

type RenameResponse struct{}

type RenamePathCommand struct {
	repo domain.Repository
}

func NewRenameCommand(repo domain.Repository) *RenamePathCommand {
	return &RenamePathCommand{repo: repo}
}

func (c *RenamePathCommand) Name() string {
	return RenameName
}

func (c *RenamePathCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[RenameRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if err := c.repo.RenamePath(request.VoltPath, request.OldPath, request.NewPath); err != nil {
		return nil, err
	}

	return RenameResponse{}, nil
}
