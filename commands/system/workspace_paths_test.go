package system

import "testing"

func TestNormalizeWorkspaceSubdir(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		input   string
		want    string
		wantErr bool
	}{
		"empty uses fallback": {
			input: "",
			want:  "attachments",
		},
		"windows separators normalized": {
			input: `images\pasted`,
			want:  "images/pasted",
		},
		"parent traversal rejected": {
			input:   `..\secrets`,
			wantErr: true,
		},
		"unix absolute path rejected": {
			input:   `/tmp/files`,
			wantErr: true,
		},
		"windows absolute path rejected": {
			input:   `C:\temp\files`,
			wantErr: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, err := normalizeWorkspaceSubdir(tt.input, "attachments")
			if tt.wantErr {
				if err == nil {
					t.Fatalf("normalizeWorkspaceSubdir(%q) error = nil, want error", tt.input)
				}
				return
			}

			if err != nil {
				t.Fatalf("normalizeWorkspaceSubdir(%q) error = %v", tt.input, err)
			}

			if got != tt.want {
				t.Fatalf("normalizeWorkspaceSubdir(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
