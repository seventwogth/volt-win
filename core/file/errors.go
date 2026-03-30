package file

import "errors"

var (
	ErrFileNotFound     = errors.New("file not found")
	ErrPermissionDenied = errors.New("permission denied")
	ErrPathTraversal    = errors.New("path traversal is not allowed")
	ErrAlreadyExists    = errors.New("file or directory already exists")
)
