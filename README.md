# VOLT

Volt — десктопное приложение для работы с локальными markdown-хранилищами. Проект собран на `Wails`, `Go`, `React` и `TypeScript` и ориентирован на локальный сценарий работы без отдельной базы данных и без внешнего сервера.

## Что умеет приложение

- подключать и открывать локальные volt-хранилища
- читать, создавать, переименовывать и удалять файлы внутри workspace
- редактировать markdown-заметки
- искать по имени файла и содержимому markdown
- расширяться через плагины: команды, slash-меню, страницы, file viewers, toolbar, sidebar и context menu

## Стек

- backend: `Go` + `Wails`
- frontend: `React 18`, `TypeScript`, `Vite`, `Zustand`, `Tiptap`
- desktop runtime: `Wails v2`

## Быстрый старт

### Требования

- Go `1.26+` по `go.mod`
- Node.js `20+`
- Wails CLI `v2.12.0`

### Установка зависимостей

Установите Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
```

Установите frontend-зависимости:

```bash
cd frontend
npm install
```

### Запуск в режиме разработки

Из корня проекта:

```bash
wails dev
```

### Сборка

```bash
wails build
```

Сгенерированные артефакты и платформенные файлы лежат в `build/`. Краткое описание каталога есть в [`build/README.md`](build/README.md).

## Структура репозитория

- `bootstrap/` — сборка зависимостей и Wails bindings
- `commands/` — сценарии приложения
- `core/` — доменные сущности, контракты и ошибки
- `infrastructure/` — файловая система, локальное хранение и runtime bridge
- `interfaces/wailshandler/` — публичный backend API для frontend через Wails
- `frontend/` — React-приложение, редактор и plugin runtime
- `docs/` — основная документация по проекту

## Документация

Основная точка входа — [`docs/README.md`](docs/README.md).

- [Обзор документации](docs/README.md)
- [Архитектура](docs/architecture.md)
- [Бэкенд](docs/backend.md)
- [Фронтенд](docs/frontend.md)
- [Плагинная система](docs/plugins.md)
- [Релизы и GitHub Actions](docs/release.md)
