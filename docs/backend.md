# Бэкенд

## Основные модули

- `core/volt` - сущность volt и контракт хранилища volt
- `core/file` - generic файловые сущности, ошибки и контракт repository
- `core/note` - markdown-specific абстракции заметок и документов, без generic file repository
- `core/search` - структура результатов поиска
- `core/plugin` - manifest и metadata плагинов
- `core/settings` - настройки приложения и доменный сервис локализации

## Command-слой

В `commands/` лежат отдельные команды:

- `volt/` - создание, удаление и получение списка volt
- `file/` - generic чтение, запись, дерево, удаление и переименование путей внутри workspace
- `note/` - markdown-specific команды, например создание note с нормализацией `.md`
- `search/` - полнотекстовый поиск по markdown-файлам
- `plugin/` - управление плагинами и их данными
- `settings/` - получение и изменение локализации
- `system/` - диалоги, изображения и desktop process runtime

Команды регистрируются в общем `commands.Manager` и вызываются из Wails-адаптеров по имени.

## Wails handlers

Каталог `interfaces/wailshandler/` это внешний API backend для frontend.

Имя пакета `wailshandler` сохранено намеренно, чтобы не менять Wails-namespace и текущие frontend imports из `frontend/wailsjs/go/wailshandler/*`.

Handlers группируются по зонам ответственности:

- `VoltHandler`
- `FileHandler`
- `SearchHandler`
- `PluginHandler`
- `ImageHandler`
- `SettingsHandler`

Startup lifecycle вынесен в отдельный `Lifecycle`, который сохраняет `context.Context` во внутренний Wails runtime bridge, но не публикуется во frontend через `Bind`.

## Работа с файлами

Реализация [`infrastructure/filesystem/file_repository.go`](../infrastructure/filesystem/file_repository.go) выполняет всю файловую работу.

Особенности:

- каждый путь проходит через `safePath`, чтобы не выйти за пределы выбранного volt
- скрытые файлы и каталоги игнорируются при построении дерева
- директории сортируются раньше файлов
- операции чтения и записи возвращают доменные ошибки вроде `ErrFileNotFound` и `ErrPermissionDenied`

## Хранение списка volt

Реализация [`infrastructure/persistence/local/volt_store.go`](../infrastructure/persistence/local/volt_store.go) хранит список подключенных volt в JSON-файле в домашнем каталоге пользователя.

Особенности:

- путь к файлу: `~/.volt/volts.json`
- доступ синхронизирован через `sync.RWMutex`
- повторное добавление того же пути блокируется

## Поиск

Поиск реализован в [`commands/search/search_files.go`](../commands/search/search_files.go).

Правила:

- backend ищет только по `.md`
- сначала возвращаются совпадения по имени файла
- затем совпадения по содержимому markdown
- максимум `50` результатов на запрос
- максимум `5` совпадений по содержимому на один файл

Plugin-owned форматы больше не индексируются в Go core. Их поиск собирается во frontend через runtime V3 `search.registerFileTextProvider(...)`.

## Плагины

Плагины хранятся в `~/.volt/plugins` и подгружаются отдельно от core-сервисов.

Host-side backend оставляет для них только инфраструктурные операции:

- список установленных плагинов
- загрузка исходника `main.js`
- включение и выключение
- key/value storage для plugin data
- запуск локальных процессов через `PluginHandler`

### Что делает backend для plugin runtime

Backend не исполняет plugin JS и не хранит plugin registry. Его зона ответственности уже:

- перечислить plugin folders и прочитать `manifest.json`
- загрузить содержимое `main.js`
- сохранить enabled-state в `~/.volt/plugin-state.json`
- сохранить plugin-local `data.json`
- запустить plugin-owned process внутри текущего workspace и стримить stdout/stderr/exit/error события во frontend через Wails runtime events

### Безопасность файлового доступа

Даже если плагин имеет `read` или `write`, фактические файловые операции всё равно идут через file repository:

- путь нормализуется и проверяется через `safePath`
- выход за пределы активного workspace блокируется
- hidden files не попадают в `listTree`

### Desktop process broker

Текущий backend bridge для процессов собран из:

- [`commands/system/plugin_process.go`](../commands/system/plugin_process.go)
- [`interfaces/wailshandler/plugin_process.go`](../interfaces/wailshandler/plugin_process.go)
- [`infrastructure/runtime/wails/runtime.go`](../infrastructure/runtime/wails/runtime.go)

Он:

- запускает бинарник напрямую, без `sh -c`
- ограничивает `cwd` активным `voltPath`
- публикует `stdout`, `stderr`, `exit` и `error` события во frontend через Wails runtime events
- хранит cancel-функции по `runId` и принудительно останавливает plugin-owned runs при unload

Подробное описание plugin contract находится в [docs/plugins.md](plugins.md).
