package wailshandler

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"volt/infrastructure/filesystem"
)

// VaultAssetServer serves files from vault directories over HTTP.
// URL format: /vault-asset?vault=<vault-path>&file=<relative-path>
type VaultAssetServer struct{}

func NewVaultAssetServer() *VaultAssetServer {
	return &VaultAssetServer{}
}

func (s *VaultAssetServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !strings.HasPrefix(r.URL.Path, "/vault-asset") {
		http.NotFound(w, r)
		return
	}

	vault := r.URL.Query().Get("vault")
	file := r.URL.Query().Get("file")

	if vault == "" || file == "" {
		http.Error(w, "missing vault or file parameter", http.StatusBadRequest)
		return
	}

	// Prevent path traversal
	clean := filepath.Clean(file)
	if strings.Contains(clean, "..") {
		http.Error(w, "invalid path", http.StatusForbidden)
		return
	}

	fullPath := filepath.Join(vault, clean)

	// Ensure file is inside vault
	absVault, _ := filepath.Abs(vault)
	absFile, _ := filepath.Abs(fullPath)
	insideVault, err := filesystem.IsWithinBaseDir(absVault, absFile)
	if err != nil || !insideVault {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	ext := filepath.Ext(fullPath)
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		ct = "application/octet-stream"
	}

	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "max-age=3600")
	w.Write(data)
}
