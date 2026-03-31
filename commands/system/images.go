package system

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	commandbase "volt/commands"
	"volt/infrastructure/filesystem"
)

const (
	CopyImageName       = "system.image.copy"
	SaveImageBase64Name = "system.image.saveBase64"
	ReadImageBase64Name = "system.image.readBase64"
)

type CopyImageRequest struct {
	VoltPath   string
	SourcePath string
	ImageDir   string
}

type CopyImageResponse struct {
	RelativePath string
}

type SaveImageBase64Request struct {
	VoltPath   string
	FileName   string
	ImageDir   string
	Base64Data string
}

type SaveImageBase64Response struct {
	RelativePath string
}

type ReadImageBase64Request struct {
	VoltPath string
	RelPath  string
}

type ReadImageBase64Response struct {
	DataURL string
}

type CopyImageCommand struct{}

func NewCopyImageCommand() *CopyImageCommand {
	return &CopyImageCommand{}
}

func (c *CopyImageCommand) Name() string {
	return CopyImageName
}

func (c *CopyImageCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[CopyImageRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	imageDir, err := normalizeImageDir(request.ImageDir)
	if err != nil {
		return nil, err
	}

	destDir := filepath.Join(request.VoltPath, filepath.FromSlash(imageDir))
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, err
	}

	ext := filepath.Ext(request.SourcePath)
	baseName := strings.TrimSuffix(filepath.Base(request.SourcePath), ext)
	destName := baseName + ext
	destPath := filepath.Join(destDir, destName)

	if _, err := os.Stat(destPath); err == nil {
		destName = fmt.Sprintf("%s_%d%s", baseName, time.Now().UnixMilli(), ext)
		destPath = filepath.Join(destDir, destName)
	}

	sourceFile, err := os.Open(request.SourcePath)
	if err != nil {
		return nil, err
	}
	defer sourceFile.Close()

	targetFile, err := os.Create(destPath)
	if err != nil {
		return nil, err
	}
	defer targetFile.Close()

	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		return nil, err
	}

	return CopyImageResponse{RelativePath: filesystem.JoinWorkspacePath(imageDir, destName)}, nil
}

type SaveImageBase64Command struct{}

func NewSaveImageBase64Command() *SaveImageBase64Command {
	return &SaveImageBase64Command{}
}

func (c *SaveImageBase64Command) Name() string {
	return SaveImageBase64Name
}

func (c *SaveImageBase64Command) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[SaveImageBase64Request](c.Name(), req)
	if err != nil {
		return nil, err
	}

	imageDir, err := normalizeImageDir(request.ImageDir)
	if err != nil {
		return nil, err
	}

	destDir := filepath.Join(request.VoltPath, filepath.FromSlash(imageDir))
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, err
	}

	data, err := base64.StdEncoding.DecodeString(request.Base64Data)
	if err != nil {
		return nil, err
	}

	ext := filepath.Ext(request.FileName)
	baseName := strings.TrimSuffix(request.FileName, ext)
	if ext == "" {
		ext = ".png"
	}

	destName := baseName + ext
	destPath := filepath.Join(destDir, destName)
	if _, err := os.Stat(destPath); err == nil {
		destName = fmt.Sprintf("%s_%d%s", baseName, time.Now().UnixMilli(), ext)
		destPath = filepath.Join(destDir, destName)
	}

	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return nil, err
	}

	return SaveImageBase64Response{RelativePath: filesystem.JoinWorkspacePath(imageDir, destName)}, nil
}

type ReadImageBase64Command struct{}

func NewReadImageBase64Command() *ReadImageBase64Command {
	return &ReadImageBase64Command{}
}

func (c *ReadImageBase64Command) Name() string {
	return ReadImageBase64Name
}

func (c *ReadImageBase64Command) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[ReadImageBase64Request](c.Name(), req)
	if err != nil {
		return nil, err
	}

	cleanPath := filesystem.NormalizeWorkspacePath(request.RelPath)
	if cleanPath == ".." || strings.HasPrefix(cleanPath, "../") || isAbsoluteWorkspacePath(request.RelPath) {
		return nil, fmt.Errorf("invalid path")
	}

	fullPath := filepath.Join(request.VoltPath, filepath.FromSlash(cleanPath))
	absVolt, err := filepath.Abs(request.VoltPath)
	if err != nil {
		return nil, err
	}

	absFile, err := filepath.Abs(fullPath)
	if err != nil {
		return nil, err
	}

	if !strings.HasPrefix(absFile, absVolt) {
		return nil, fmt.Errorf("path traversal detected")
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, err
	}

	contentType := mime.TypeByExtension(filepath.Ext(fullPath))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return ReadImageBase64Response{
		DataURL: fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(data)),
	}, nil
}

func normalizeImageDir(imageDir string) (string, error) {
	return normalizeWorkspaceSubdir(imageDir, "attachments")
}
