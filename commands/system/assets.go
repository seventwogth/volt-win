package system

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	commandbase "volt/commands"
	"volt/infrastructure/filesystem"
)

const CopyAssetName = "system.asset.copy"

type CopyAssetRequest struct {
	VoltPath   string
	SourcePath string
	TargetDir  string
}

type CopyAssetResponse struct {
	RelativePath string
}

type CopyAssetCommand struct{}

func NewCopyAssetCommand() *CopyAssetCommand {
	return &CopyAssetCommand{}
}

func (c *CopyAssetCommand) Name() string {
	return CopyAssetName
}

func (c *CopyAssetCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[CopyAssetRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	targetDir, err := normalizeAssetTargetDir(request.TargetDir)
	if err != nil {
		return nil, err
	}

	destDir := filepath.Join(request.VoltPath, filepath.FromSlash(targetDir))
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return nil, err
	}

	ext := filepath.Ext(request.SourcePath)
	baseName := strings.TrimSuffix(filepath.Base(request.SourcePath), ext)
	if baseName == "" {
		baseName = "asset"
	}
	if err := filesystem.ValidateWorkspaceName(baseName + ext); err != nil {
		return nil, err
	}

	destName := baseName + ext
	destPath := filepath.Join(destDir, destName)
	if _, err := os.Stat(destPath); err == nil {
		destName = fmt.Sprintf("%s_%d%s", baseName, time.Now().UnixMilli(), ext)
		if err := filesystem.ValidateWorkspaceName(destName); err != nil {
			return nil, err
		}
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

	return CopyAssetResponse{RelativePath: filesystem.JoinWorkspacePath(targetDir, destName)}, nil
}

func normalizeAssetTargetDir(targetDir string) (string, error) {
	return normalizeWorkspaceSubdir(targetDir, "attachments")
}
