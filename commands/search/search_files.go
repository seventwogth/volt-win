package search

import (
	"context"
	"path/filepath"
	"strings"

	commandbase "volt/commands"
	corefile "volt/core/file"
	domain "volt/core/search"
)

const maxResults = 50

const SearchFilesName = "search.files"

type SearchFilesRequest struct {
	VoltPath string
	Query    string
}

type SearchFilesResponse struct {
	Results []domain.SearchResult
}

type SearchFilesCommand struct {
	repo corefile.Repository
}

func NewSearchFilesCommand(repo corefile.Repository) *SearchFilesCommand {
	return &SearchFilesCommand{repo: repo}
}

func (c *SearchFilesCommand) Name() string {
	return SearchFilesName
}

func (c *SearchFilesCommand) Execute(ctx context.Context, req any) (any, error) {
	request, err := commandbase.Decode[SearchFilesRequest](c.Name(), req)
	if err != nil {
		return nil, err
	}

	if request.Query == "" {
		return SearchFilesResponse{Results: []domain.SearchResult{}}, nil
	}

	entries, err := c.repo.ListDirectory(request.VoltPath, "")
	if err != nil {
		return nil, err
	}

	queryLower := strings.ToLower(request.Query)

	var nameMatches []domain.SearchResult
	var contentMatches []domain.SearchResult
	searchEntries(entries, request.VoltPath, queryLower, c.repo, &nameMatches, &contentMatches)

	results := make([]domain.SearchResult, 0, len(nameMatches)+len(contentMatches))
	results = append(results, nameMatches...)
	results = append(results, contentMatches...)

	if len(results) > maxResults {
		results = results[:maxResults]
	}

	return SearchFilesResponse{Results: results}, nil
}

func searchEntries(
	entries []corefile.FileEntry,
	voltPath, queryLower string,
	repo corefile.Repository,
	nameMatches, contentMatches *[]domain.SearchResult,
) {
	for _, entry := range entries {
		if len(*nameMatches)+len(*contentMatches) >= maxResults {
			return
		}

		if entry.IsDir {
			searchEntries(entry.Children, voltPath, queryLower, repo, nameMatches, contentMatches)
			continue
		}

		fileName := filepath.Base(entry.Path)
		fileNameLower := strings.ToLower(fileName)
		if !strings.HasSuffix(fileNameLower, ".md") {
			continue
		}

		if strings.Contains(fileNameLower, queryLower) {
			*nameMatches = append(*nameMatches, domain.SearchResult{
				FilePath: entry.Path,
				FileName: fileName,
				Snippet:  "",
				Line:     0,
				IsName:   true,
			})
		}

		if len(*nameMatches)+len(*contentMatches) >= maxResults {
			return
		}

		results, err := searchMarkdownContent(entry.Path, fileName, repo, voltPath, queryLower)
		if err == nil && len(results) > 0 {
			remaining := maxResults - len(*nameMatches) - len(*contentMatches)
			if len(results) > remaining {
				results = results[:remaining]
			}
			*contentMatches = append(*contentMatches, results...)
		}
	}
}

func searchMarkdownContent(
	relPath, fileName string,
	repo corefile.Repository,
	voltPath, queryLower string,
) ([]domain.SearchResult, error) {
	content, err := repo.ReadFile(voltPath, relPath)
	if err != nil {
		return nil, err
	}

	var results []domain.SearchResult
	for lineNum, line := range strings.Split(content, "\n") {
		lineLower := strings.ToLower(line)

		idx := strings.Index(lineLower, queryLower)
		if idx < 0 {
			continue
		}

		results = append(results, domain.SearchResult{
			FilePath: relPath,
			FileName: fileName,
			Snippet:  extractSnippet(line, idx, len(queryLower)),
			Line:     lineNum + 1,
			IsName:   false,
		})

		if len(results) >= 5 {
			break
		}
	}

	return results, nil
}

func extractSnippet(line string, matchIdx, matchLen int) string {
	const contextChars = 50

	start := matchIdx - contextChars
	if start < 0 {
		start = 0
	}

	end := matchIdx + matchLen + contextChars
	if end > len(line) {
		end = len(line)
	}

	snippet := line[start:end]

	if start > 0 {
		snippet = "..." + snippet
	}
	if end < len(line) {
		snippet = snippet + "..."
	}

	return snippet
}
