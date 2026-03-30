package file

type Repository interface {
	ReadFile(voltPath, filePath string) (string, error)
	WriteFile(voltPath, filePath, content string) error
	ListDirectory(voltPath, dirPath string) ([]FileEntry, error)
	CreateFile(voltPath, filePath string) error
	CreateDirectory(voltPath, dirPath string) error
	DeletePath(voltPath, filePath string) error
	RenamePath(voltPath, oldPath, newPath string) error
}
