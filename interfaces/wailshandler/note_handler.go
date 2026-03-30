package wailshandler

import (
	"context"

	commandbase "volt/commands"
	commandnote "volt/commands/note"
	coresettings "volt/core/settings"
)

type NoteHandler struct {
	manager      *commandbase.Manager
	localization *coresettings.LocalizationService
}

func NewNoteHandler(
	manager *commandbase.Manager,
	localization *coresettings.LocalizationService,
) *NoteHandler {
	return &NoteHandler{
		manager:      manager,
		localization: localization,
	}
}

func (h *NoteHandler) CreateNote(voltPath, filePath string) error {
	_, err := commandbase.Execute[commandnote.CreateNoteResponse](
		context.Background(),
		h.manager,
		commandnote.CreateNoteName,
		commandnote.CreateNoteRequest{VoltPath: voltPath, FilePath: filePath},
	)
	if err != nil {
		return localizedFileError(h.localization, "backend.action.createNote", quotedPathParam(filePath), err)
	}
	return nil
}
