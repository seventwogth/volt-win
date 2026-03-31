package filesystem

import "testing"

func TestNormalizeWorkspacePath(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		input string
		want  string
	}{
		"empty": {
			input: "",
			want:  "",
		},
		"windows separators": {
			input: `notes\ideas\plan.md`,
			want:  "notes/ideas/plan.md",
		},
		"mixed separators and dots": {
			input: `.\notes/ideas\../plan.md`,
			want:  "notes/plan.md",
		},
		"parent traversal stays explicit": {
			input: `../notes\plan.md`,
			want:  "../notes/plan.md",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			if got := NormalizeWorkspacePath(tt.input); got != tt.want {
				t.Fatalf("NormalizeWorkspacePath(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestJoinWorkspacePath(t *testing.T) {
	t.Parallel()

	got := JoinWorkspacePath(`attachments\images`, `nested\preview.png`)
	want := "attachments/images/nested/preview.png"
	if got != want {
		t.Fatalf("JoinWorkspacePath() = %q, want %q", got, want)
	}
}
