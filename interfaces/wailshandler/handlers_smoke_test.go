package wailshandler

import (
	"context"
	"testing"

	commandbase "volt/commands"
	commandfile "volt/commands/file"
	commandsettings "volt/commands/settings"
	commandvolt "volt/commands/volt"
	coresettings "volt/core/settings"
	corevolt "volt/core/volt"
)

type handlerStubCommand struct {
	name string
	run  func(ctx context.Context, req any) (any, error)
}

func (c handlerStubCommand) Name() string {
	return c.name
}

func (c handlerStubCommand) Execute(ctx context.Context, req any) (any, error) {
	return c.run(ctx, req)
}

func TestVoltHandlerListVoltsUsesCommandManager(t *testing.T) {
	manager := commandbase.MustNewManager(handlerStubCommand{
		name: commandvolt.ListName,
		run: func(ctx context.Context, req any) (any, error) {
			return commandvolt.ListResponse{
				Volts: []corevolt.Volt{{ID: "volt-1", Name: "Main"}},
			}, nil
		},
	})

	handler := NewVoltHandler(manager, nil)
	volts, err := handler.ListVolts()
	if err != nil {
		t.Fatalf("ListVolts() error = %v", err)
	}

	if len(volts) != 1 || volts[0].ID != "volt-1" {
		t.Fatalf("volts = %#v, want one volt with ID %q", volts, "volt-1")
	}
}

func TestFileHandlerReadFileUsesCommandManager(t *testing.T) {
	manager := commandbase.MustNewManager(handlerStubCommand{
		name: commandfile.ReadName,
		run: func(ctx context.Context, req any) (any, error) {
			request, ok := req.(commandfile.ReadRequest)
			if !ok {
				t.Fatalf("unexpected request type %T", req)
			}
			if request.FilePath != "notes/test.md" {
				t.Fatalf("request.FilePath = %q, want %q", request.FilePath, "notes/test.md")
			}

			return commandfile.ReadResponse{Content: "# Test"}, nil
		},
	})

	handler := NewFileHandler(manager, nil)
	content, err := handler.ReadFile("/tmp/volt", "notes/test.md")
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	if content != "# Test" {
		t.Fatalf("content = %q, want %q", content, "# Test")
	}
}

func TestSettingsHandlerGetLocalizationUsesCommandManager(t *testing.T) {
	manager := commandbase.MustNewManager(handlerStubCommand{
		name: commandsettings.GetLocalizationName,
		run: func(ctx context.Context, req any) (any, error) {
			return commandsettings.GetLocalizationResponse{
				Payload: coresettings.LocalizationPayload{
					SelectedLocale:  coresettings.AutoLocale,
					EffectiveLocale: "en",
					Messages:        map[string]string{"settings.title": "Settings"},
				},
			}, nil
		},
	})

	handler := NewSettingsHandler(manager)
	payload, err := handler.GetLocalization([]string{"en-US"})
	if err != nil {
		t.Fatalf("GetLocalization() error = %v", err)
	}

	if payload.EffectiveLocale != "en" {
		t.Fatalf("payload.EffectiveLocale = %q, want %q", payload.EffectiveLocale, "en")
	}
}
