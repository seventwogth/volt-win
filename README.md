# VOLT Windows Fork

Этот репозиторий — Windows-ориентированный форк VOLT.

Форк сохраняет исходную архитектуру приложения на `Wails`, `Go`, `React` и `TypeScript`, но в первую очередь нацелен на разработку, упаковку и runtime-поведение в Windows. В частности, здесь поддерживаются Windows-специфичные изменения вокруг файловой системы, запуска процессов, упаковки приложения и release-артефактов.

## Что Это За Форк

- Десктопное приложение для работы с локальными Markdown-workspace
- Windows-first форк с явной поддержкой правил Windows для путей, имён файлов и упаковки
- Wails-приложение с backend на Go и frontend на React

## Фокус На Windows

По сравнению с исходной базой этот форк сопровождается с Windows как с основной средой.

- Операции с файлами и каталогами валидируются по правилам именования Windows
- Запуск plugin process учитывает Windows command resolution и batch execution
- Release-артефакты включают Windows ZIP и NSIS installer
- Документация и build flow в репозитории ориентированы прежде всего на Windows-разработку

## Основные Возможности

- Открытие и управление локальными Volt-workspace
- Создание, переименование, перемещение и удаление файлов и папок внутри workspace
- Редактирование Markdown-заметок
- Поиск по именам файлов и содержимому заметок
- Расширение приложения через плагины, команды, slash-меню, страницы, viewers, toolbar actions, sidebar items и context menu

## Стек

- Backend: `Go` + `Wails`
- Frontend: `React 18`, `TypeScript`, `Vite`, `Zustand`, `Tiptap`
- Desktop runtime: `Wails v2`

## Требования

- Go `1.26+`
- Node.js `20+`
- Wails CLI `v2.12.0`
- Основная целевая среда для этого форка — Windows

## Быстрый Старт

Установите Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.12.0
```

Установите frontend-зависимости:

```bash
cd frontend
npm ci
```

Запуск в режиме разработки из корня репозитория:

```bash
wails dev
```

Сборка production-ассетов frontend:

```bash
cd frontend
npm run build
```

Сборка desktop-приложения:

```bash
wails build
```

Сгенерированные frontend-ассеты лежат в `frontend/dist/`.
Сгенерированные бинарники приложения лежат в `build/bin/`.
Это build-артефакты, их нельзя коммитить в репозиторий.

## Структура Репозитория

- `bootstrap/` - wiring зависимостей и Wails bindings
- `commands/` - сценарии приложения
- `core/` - доменные типы, контракты и ошибки
- `infrastructure/` - файловая система, локальное хранилище и runtime bridge
- `interfaces/wailshandler/` - backend API, доступный frontend через Wails
- `frontend/` - React-приложение, UI-редактор и plugin runtime
- `docs/` - документация по проекту
- `build/windows/` - Windows-артефакты упаковки, включая конфигурацию инсталлятора

## Release Notes

Release pipeline описан в [docs/release.md](docs/release.md).

Для этого форка особенно важны Windows-артефакты:

- `volt-windows-amd64.zip`
- `volt-windows-amd64-installer.exe`

## Документация

Точка входа: [docs/README.md](docs/README.md)

- [Архитектура](docs/architecture.md)
- [Backend](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Плагинная система](docs/plugins.md)
- [Release pipeline](docs/release.md)
