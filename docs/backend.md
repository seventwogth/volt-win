# Бэкенд

## Роль backend

Backend в Volt отвечает за локальные операции:

- работу с volt-хранилищами
- файловые операции внутри активного workspace
- создание markdown-заметок
- поиск по markdown
- хранение и загрузку плагинов
- локализацию и системные desktop-операции

Отдельного сетевого API или базы данных здесь нет: backend работает только с локальной файловой системой и Wails runtime.

## Структура слоёв

### `core/`

Доменные сущности, контракты и ошибки:

- `core/volt` — сущность volt и контракт репозитория
- `core/file` — файловые сущности, репозиторий и доменные ошибки
- `core/note` — сущности и абстракции заметок
- `core/search` — структура результатов поиска
- `core/plugin` — manifest, настройки плагинов и plugin-specific ошибки
- `core/settings` — локализация и настройки приложения

### `commands/`

Сценарии приложения, зарегистрированные в `commands.Manager`:

- `volt/` — список, создание и удаление volt
- `file/` — чтение, запись, дерево, создание, удаление и переименование файлов и каталогов
- `note/` — создание markdown-note с доменной нормализацией
- `search/` — поиск по markdown-файлам
- `plugin/` — каталог плагинов, импорт ZIP-архивов, загрузка исходников и plugin data
- `settings/` — получение локализации и переключение языка
- `system/` — диалоги, изображения, копирование assets и локальные процессы

### `infrastructure/`

Конкретные реализации для локальной среды:

- `infrastructure/filesystem/file_repository.go` — файловые операции внутри workspace
- `infrastructure/filesystem/plugin_store.go` — каталог плагинов, `plugin-state.json`, `data.json`, импорт ZIP-архивов
- `infrastructure/persistence/local/volt_store.go` — хранение `~/.volt/volts.json`
- `infrastructure/persistence/local/settings_store.go` — настройки приложения
- `infrastructure/runtime/wails/runtime.go` — bridge к Wails runtime

### `interfaces/wailshandler/`

Публичный backend API для frontend:

- `VoltHandler`
- `FileHandler`
- `NoteHandler`
- `SearchHandler`
- `PluginCatalogHandler`
- `PluginRuntimeHandler`
- `ImageHandler`
- `SettingsHandler`
- `Lifecycle`

`Lifecycle` нужен для startup/dom-ready hooks и не публикуется во frontend как отдельный API namespace.

## Dependency wiring

Все зависимости собираются вручную в [`bootstrap/container.go`](../bootstrap/container.go).

Container:

- создаёт store-ы и runtime bridge
- собирает `commands.Manager`
- создаёт handlers поверх manager-а
- отдаёт их в Wails через `Bindings()`

Такой подход упрощает навигацию по проекту: путь от UI-сценария до конкретной команды остаётся явным.

## Работа с файлами

Главная реализация находится в [`infrastructure/filesystem/file_repository.go`](../infrastructure/filesystem/file_repository.go).

Что важно:

- каждый путь проходит через защиту от выхода за пределы активного workspace
- скрытые файлы и каталоги не попадают в дерево
- директории сортируются раньше файлов
- чтение и запись возвращают доменные ошибки вместо сырых системных сообщений

Файловые handlers вызывают команды по имени и локализуют ошибки перед возвратом во frontend.

## Создание заметок

Создание markdown-note вынесено в отдельный `NoteHandler` и команды из `commands/note/`.

Это отделяет note-specific поведение от generic файлового API:

- обычные файлы создаются через `FileHandler`
- markdown-заметки создаются через `NoteHandler`

## Поиск

Поиск реализован в [`commands/search/search_files.go`](../commands/search/search_files.go).

Текущее поведение:

- backend ищет только по `.md`
- сначала формируются совпадения по имени файла
- затем совпадения по содержимому
- максимум `50` результатов на запрос
- максимум `5` совпадений по содержимому на один файл

Plugin-owned форматы backend не индексирует. Они добавляются во frontend через зарегистрированные search providers.

## Плагины на стороне backend

Backend знает о плагинах как о локальных пакетах в `~/.volt/plugins`.

Что он делает:

- перечисляет установленные плагины и читает `manifest.json`
- валидирует `apiVersion`, `id`, `name`, `version` и entry file
- возвращает путь к каталогу плагинов
- загружает исходник `main.js`
- хранит состояние включения в `~/.volt/plugin-state.json`
- хранит plugin-local данные в `data.json`
- импортирует плагины из ZIP-архивов
- запускает локальные процессы плагинов

Сейчас поддерживается только `apiVersion: 4`.

### Разделение plugin handlers

Слой Wails намеренно разделён на два handler-а:

- `PluginCatalogHandler` — список плагинов, каталог, импорт, удаление, enable/disable
- `PluginRuntimeHandler` — загрузка исходников, plugin data, file picker, копирование assets и process bridge

Это отражает текущую границу между каталогом плагинов и runtime-операциями.

## Импорт плагинов

Импорт реализован в [`infrastructure/filesystem/plugin_store.go`](../infrastructure/filesystem/plugin_store.go).

Основные ограничения:

- архив должен содержать один plugin root
- внутри root должен быть корректный `manifest.json`
- entry file из `manifest.main` обязан существовать
- абсолютные пути, path traversal и symlink entries отклоняются

После импорта плагин появляется в списке, но по умолчанию остаётся выключенным, пока frontend явно не включит его.

## Desktop process broker

Desktop-process runtime собран из:

- [`commands/system/plugin_process.go`](../commands/system/plugin_process.go)
- [`interfaces/wailshandler/plugin_process.go`](../interfaces/wailshandler/plugin_process.go)
- [`infrastructure/runtime/wails/runtime.go`](../infrastructure/runtime/wails/runtime.go)

Он:

- запускает бинарник напрямую, без `sh -c`
- ограничивает `cwd` активным workspace
- публикует `stdout`, `stderr`, `exit` и `error` события во frontend
- умеет отменять запущенные процессы по `runId`

## Локализация

Backend также отвечает за локализацию системных сообщений и ошибок:

- словари лежат в `core/settings/locales/`
- `SettingsHandler` отдаёт локализованный payload во frontend
- Wails handlers локализуют backend errors перед возвратом в UI

Подробности по frontend-side поведению вынесены в [`frontend.md`](frontend.md), а plugin contract описан в [`plugins.md`](plugins.md).
