package plugin

import (
	"context"

	commandbase "volt/commands"
	coreplugin "volt/core/plugin"
)

const GetPluginsDirectoryName = "plugin.getPluginsDirectory"

type GetPluginsDirectoryRequest struct{}

type GetPluginsDirectoryResponse struct {
	Path string
}

type GetPluginsDirectoryCommand struct {
	repo coreplugin.Repository
}

func NewGetPluginsDirectoryCommand(repo coreplugin.Repository) *GetPluginsDirectoryCommand {
	return &GetPluginsDirectoryCommand{repo: repo}
}

func (c *GetPluginsDirectoryCommand) Name() string {
	return GetPluginsDirectoryName
}

func (c *GetPluginsDirectoryCommand) Execute(ctx context.Context, req any) (any, error) {
	if _, err := commandbase.Decode[GetPluginsDirectoryRequest](c.Name(), req); err != nil {
		return nil, err
	}

	return GetPluginsDirectoryResponse{Path: c.repo.GetPluginsDirectory()}, nil
}
