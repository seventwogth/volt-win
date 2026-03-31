package note

import (
	"context"
	"strings"

	commandbase "volt/commands"
	domain "volt/core/file"
	corenote "volt/core/note"
	"volt/infrastructure/filesystem"
)

const CreateNoteName = "note.createNote"

type CreateNoteRequest struct {
	VoltPath string
	FilePath string
}

type CreateNoteResponse struct {
	Note corenote.Note `json:"note"`
}

type CreateNoteCommand struct {
	repo domain.Repository
}

func NewCreateNoteCommand(repo domain.Repository) *CreateNoteCommand {
	return &CreateNoteCommand{repo: repo}
}

func (c *CreateNoteCommand) Name() string {
	return CreateNoteName
}

func (c *CreateNoteCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[CreateNoteRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	filePath := request.FilePath
	if !strings.HasSuffix(filePath, ".md") {
		filePath += ".md"
	}
	filePath = filesystem.NormalizeWorkspacePath(filePath)

	if err := c.repo.CreateFile(request.VoltPath, filePath); err != nil {
		return nil, err
	}

	return CreateNoteResponse{
		Note: corenote.Note{
			Path:    filePath,
			Name:    filesystem.WorkspaceBase(filePath),
			Content: "",
		},
	}, nil
}
