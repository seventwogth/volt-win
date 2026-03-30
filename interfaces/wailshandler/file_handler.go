package wailshandler

import (
	"context"

	commandbase "volt/commands"
	commandfile "volt/commands/file"
	commandnote "volt/commands/note"
	domain "volt/core/file"
	coresettings "volt/core/settings"
)

type FileHandler struct {
	manager      *commandbase.Manager
	localization *coresettings.LocalizationService
}

func NewFileHandler(
	manager *commandbase.Manager,
	localization *coresettings.LocalizationService,
) *FileHandler {
	return &FileHandler{
		manager:      manager,
		localization: localization,
	}
}

func (h *FileHandler) ReadFile(voltPath, filePath string) (string, error) {
	result, err := commandbase.Execute[commandfile.ReadResponse](
		context.Background(),
		h.manager,
		commandfile.ReadName,
		commandfile.ReadRequest{VoltPath: voltPath, FilePath: filePath},
	)
	if err != nil {
		return "", localizedFileError(h.localization, "backend.action.readFile", quotedPathParam(filePath), err)
	}
	return result.Content, nil
}

func (h *FileHandler) WriteFile(voltPath, filePath, content string) error {
	_, err := commandbase.Execute[commandfile.SaveResponse](
		context.Background(),
		h.manager,
		commandfile.SaveName,
		commandfile.SaveRequest{VoltPath: voltPath, FilePath: filePath, Content: content},
	)
	if err != nil {
		return localizedFileError(h.localization, "backend.action.writeFile", quotedPathParam(filePath), err)
	}
	return nil
}

func (h *FileHandler) ListTree(voltPath, dirPath string) ([]domain.FileEntry, error) {
	result, err := commandbase.Execute[commandfile.ListTreeResponse](
		context.Background(),
		h.manager,
		commandfile.ListTreeName,
		commandfile.ListTreeRequest{VoltPath: voltPath, DirPath: dirPath},
	)
	if err != nil {
		return nil, localizedFileError(h.localization, "backend.action.listTree", quotedPathParam(dirPath), err)
	}
	return result.Entries, nil
}

func (h *FileHandler) CreateNote(voltPath, filePath string) error {
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

func (h *FileHandler) CreateFile(voltPath, filePath, content string) error {
	_, err := commandbase.Execute[commandfile.CreateFileResponse](
		context.Background(),
		h.manager,
		commandfile.CreateFileName,
		commandfile.CreateFileRequest{VoltPath: voltPath, FilePath: filePath, Content: content},
	)
	if err != nil {
		return localizedFileError(h.localization, "backend.action.createFile", quotedPathParam(filePath), err)
	}
	return nil
}

func (h *FileHandler) CreateDirectory(voltPath, dirPath string) error {
	_, err := commandbase.Execute[commandfile.CreateDirectoryResponse](
		context.Background(),
		h.manager,
		commandfile.CreateDirectoryName,
		commandfile.CreateDirectoryRequest{VoltPath: voltPath, DirPath: dirPath},
	)
	if err != nil {
		return localizedFileError(h.localization, "backend.action.createDirectory", quotedPathParam(dirPath), err)
	}
	return nil
}

func (h *FileHandler) DeletePath(voltPath, filePath string) error {
	_, err := commandbase.Execute[commandfile.DeleteResponse](
		context.Background(),
		h.manager,
		commandfile.DeleteName,
		commandfile.DeleteRequest{VoltPath: voltPath, FilePath: filePath},
	)
	if err != nil {
		return localizedFileError(h.localization, "backend.action.deletePath", quotedPathParam(filePath), err)
	}
	return nil
}

func (h *FileHandler) RenamePath(voltPath, oldPath, newPath string) error {
	_, err := commandbase.Execute[commandfile.RenameResponse](
		context.Background(),
		h.manager,
		commandfile.RenameName,
		commandfile.RenameRequest{VoltPath: voltPath, OldPath: oldPath, NewPath: newPath},
	)
	if err != nil {
		return localizedFileError(h.localization, "backend.action.renamePath", renameParams(oldPath, newPath), err)
	}
	return nil
}
