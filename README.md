# VOLT Windows Fork

This repository is a Windows-focused fork of VOLT.

The fork keeps the original app architecture based on `Wails`, `Go`, `React`, and `TypeScript`, but its primary target is Windows development, packaging, and runtime behavior. In particular, this fork carries Windows-specific work around file-system behavior, process launching, packaging, and release artifacts.

## What This Fork Is

- A desktop knowledge-management app for local Markdown workspaces
- A Windows-first fork with explicit support for Windows path rules, file naming constraints, and packaging
- A Wails desktop app with Go backend and React frontend

## Windows Focus

Compared to the upstream baseline, this fork is maintained with Windows as the primary environment.

- File and directory operations are validated against Windows naming rules
- Plugin process launching supports Windows command resolution and batch execution
- Release artifacts include Windows ZIP and NSIS installer outputs
- Repository docs and build flow are oriented around Windows development first

## Core Features

- Open and manage local Volt workspaces
- Create, rename, move, and delete files and folders inside a workspace
- Edit Markdown notes
- Search by filename and note content
- Extend the app through plugins, commands, slash menus, pages, viewers, toolbar actions, sidebar items, and context-menu entries

## Stack

- Backend: `Go` + `Wails`
- Frontend: `React 18`, `TypeScript`, `Vite`, `Zustand`, `Tiptap`
- Desktop runtime: `Wails v2`

## Requirements

- Go `1.26+`
- Node.js `20+`
- Wails CLI `v2.12.0`
- Windows development environment is the primary supported target for this fork

## Quick Start

Install Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
```

Install frontend dependencies:

```bash
cd frontend
npm ci
```

Run in development mode from the repository root:

```bash
wails dev
```

Build production assets:

```bash
cd frontend
npm run build
```

Build the desktop app:

```bash
wails build
```

Generated frontend assets live in `frontend/dist/`.
Generated application binaries live in `build/bin/`.
These are build artifacts and must not be committed.

## Repository Layout

- `bootstrap/` - dependency wiring and Wails bindings
- `commands/` - application use cases
- `core/` - domain types, contracts, and errors
- `infrastructure/` - file system, local persistence, and runtime bridge
- `interfaces/wailshandler/` - backend API exposed to the frontend through Wails
- `frontend/` - React app, editor UI, and plugin runtime
- `docs/` - project documentation
- `build/windows/` - Windows packaging assets, including installer configuration

## Release Notes

The release pipeline is documented in [docs/release.md](docs/release.md).

For this fork, Windows release outputs are especially important:

- `volt-windows-amd64.zip`
- `volt-windows-amd64-installer.exe`

## Documentation

Start here: [docs/README.md](docs/README.md)

- [Architecture](docs/architecture.md)
- [Backend](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Plugin System](docs/plugins.md)
- [Release Pipeline](docs/release.md)
