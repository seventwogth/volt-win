//go:build windows

package system

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"

	corefile "volt/core/file"
)

func TestCopyAssetRejectsWindowsInvalidTargetName(t *testing.T) {
	t.Parallel()

	command := NewCopyAssetCommand()
	voltPath := t.TempDir()

	_, err := command.Execute(context.Background(), CopyAssetRequest{
		VoltPath:   voltPath,
		SourcePath: `C:\external\bad:name.txt`,
		TargetDir:  "attachments",
	})
	if !errors.Is(err, corefile.ErrInvalidName) {
		t.Fatalf("Execute() error = %v, want %v", err, corefile.ErrInvalidName)
	}
}

func TestCopyImageRejectsWindowsInvalidTargetName(t *testing.T) {
	t.Parallel()

	command := NewCopyImageCommand()
	voltPath := t.TempDir()

	_, err := command.Execute(context.Background(), CopyImageRequest{
		VoltPath:   voltPath,
		SourcePath: `C:\external\CON.png`,
		ImageDir:   "attachments",
	})
	if !errors.Is(err, corefile.ErrInvalidName) {
		t.Fatalf("Execute() error = %v, want %v", err, corefile.ErrInvalidName)
	}
}

func TestSaveImageBase64RejectsWindowsInvalidFileName(t *testing.T) {
	t.Parallel()

	command := NewSaveImageBase64Command()
	voltPath := t.TempDir()

	_, err := command.Execute(context.Background(), SaveImageBase64Request{
		VoltPath:   voltPath,
		FileName:   `bad:name`,
		ImageDir:   "attachments",
		Base64Data: base64.StdEncoding.EncodeToString([]byte("png")),
	})
	if !errors.Is(err, corefile.ErrInvalidName) {
		t.Fatalf("Execute() error = %v, want %v", err, corefile.ErrInvalidName)
	}
}
