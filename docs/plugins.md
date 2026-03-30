# Плагинная система Volt

## Кратко

Плагины в Volt — это внешние frontend-расширения, которые лежат в `~/.volt/plugins` и выполняются внутри desktop-приложения через ограниченный host API.

Плагин может:

- добавлять команды в command palette
- добавлять slash-команды в редактор
- регистрировать plugin pages в табах и на отдельных маршрутах
- добавлять кнопки в toolbar и sidebar
- добавлять sidebar panels
- регистрировать file viewers для собственных форматов
- подключать search providers для файлов, которыми владеет плагин
- читать и писать файлы активного workspace через permission-guarded API
- работать с editor sessions и host editors
- запускать локальные процессы внутри workspace

Плагин не получает прямой доступ к Go handlers, shell, файловой системе или внутренним store-ам приложения. Все привилегированные действия идут только через объект `api`, который создаёт host runtime.

## Где живут плагины

- каталог плагинов: `~/.volt/plugins`
- состояние включения: `~/.volt/plugin-state.json`
- plugin-local storage: `~/.volt/plugins/<plugin-id>/data.json`

Типичная структура плагина:

```text
~/.volt/plugins/my-plugin/
  manifest.json
  main.js
  data.json
```

`data.json` создаётся автоматически при первом `storage.set(...)`.

## Поддерживаемая версия API

Сейчас поддерживается только `apiVersion: 4`.

Если в `manifest.json` указана другая версия, backend не загрузит такой плагин и вернёт ошибку `unsupported apiVersion`.

## Жизненный цикл

### 1. Обнаружение

Backend перечисляет подпапки в `~/.volt/plugins`, читает `manifest.json` и валидирует его.

### 2. Включение

Когда пользователь включает плагин в `Settings`:

- состояние записывается в `~/.volt/plugin-state.json`
- если workspace уже открыт, frontend сразу загружает плагин
- если активного workspace нет, плагин загрузится при следующем открытии workspace

### 3. Загрузка

При открытии workspace frontend вызывает `loadAllPlugins(voltPath)`:

1. очищает регистрации, listeners, editor sessions, host editors и process runs
2. получает список плагинов из backend
3. оставляет только `enabled` плагины
4. загружает `main.js`
5. исполняет entry через `new Function('api', source)`

### 4. Выгрузка

При выгрузке runtime:

- снимаются listeners, зарегистрированные runtime
- отменяются процессы, принадлежащие плагину
- освобождаются editor sessions и host editors
- очищаются task statuses
- удаляются регистрации из `pluginRegistry`
- закрываются plugin tabs

## Формат `manifest.json`

Минимальный manifest:

```json
{
  "apiVersion": 4,
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Example Volt plugin",
  "main": "main.js",
  "permissions": ["read"]
}
```

Основные поля:

- `apiVersion` — обязательная версия plugin API, сейчас только `4`
- `id` — стабильный идентификатор
- `name` — отображаемое имя
- `version` — версия плагина
- `description` — краткое описание
- `main` — entry file, обычно `main.js`
- `permissions` — список разрешений
- `settings` — необязательная host-rendered schema настроек

### Настройки в `manifest.json`

Если плагину нужны настройки, они объявляются declarative в `settings.sections`:

```json
{
  "apiVersion": 4,
  "id": "quick-note",
  "name": "Quick Note",
  "version": "1.0.0",
  "description": "Capture notes into inbox",
  "main": "main.js",
  "permissions": ["read", "write"],
  "settings": {
    "sections": [
      {
        "id": "general",
        "title": "General",
        "description": "Plugin settings",
        "fields": [
          {
            "key": "inboxPath",
            "type": "text",
            "label": "Inbox path",
            "defaultValue": "inbox/capture.md"
          },
          {
            "key": "openAfterWrite",
            "type": "toggle",
            "label": "Open after write",
            "defaultValue": false
          }
        ]
      }
    ]
  }
}
```

Поддерживаемые типы полей:

- `toggle`
- `text`
- `textarea`
- `number`
- `select`

## Permissions

Текущие permissions:

- `read`
- `write`
- `editor`
- `external`
- `process`

### Что они открывают

`read`:

- `api.fs.read(...)`
- `api.fs.list(...)`
- `api.workspace.getActivePath()`
- `api.workspace.getRootPath()`
- `api.search.registerTextProvider(...)`
- `api.assets.readImageDataUrl(...)`

`write`:

- `api.fs.write(...)`
- `api.fs.create(...)`
- `api.assets.copyAsset(...)`
- `api.assets.copyImage(...)`
- `api.assets.saveImageBase64(...)`

`editor`:

- `api.editor.captureActiveSession()`
- `api.editor.openSession(...)`
- `api.editor.listKinds()`
- `api.editor.getCapabilities(...)`
- `api.editor.mount(...)`

`external`:

- `api.assets.pickFile(...)`
- `api.ui.openExternalUrl(...)`

`process`:

- `api.process.start(...)`

### Что не требует отдельного permission

- `api.assets.pickImage()`
- `api.ui.register*`
- `api.ui.promptText(...)`
- `api.ui.createTaskStatus(...)`
- `api.ui.notify(...)`
- `api.storage.*`
- `api.settings.*`
- `api.events.on(...)`

Если плагин вызывает API без нужного permission, runtime блокирует действие, пишет ошибку в plugin log и показывает уведомление пользователю.

## Public API

Ниже приведены актуальные namespace-ы host API.

### `api.fs`

```ts
read(path: string): Promise<string>
write(path: string, content: string): Promise<void>
create(path: string, content?: string): Promise<void>
list(dirPath?: string): Promise<FileEntry[]>
```

Поведение:

- все пути относительны к активному workspace
- backend дополнительно защищает операции от path traversal
- `create(...)` создаёт файл и после этого обновляет file tree

### `api.workspace`

```ts
getActivePath(): string | null
getRootPath(): string
```

- `getActivePath()` возвращает путь активной открытой вкладки файла
- `getRootPath()` возвращает абсолютный путь текущего workspace

### `api.search`

```ts
registerTextProvider(config: {
  id: string
  extensions: string[]
  extractText(input: { filePath: string; content: string }): string | Promise<string>
}): void
```

Поиск по форматам плагинов работает так:

- backend по-прежнему ищет только по markdown
- frontend читает файлы нужных расширений
- runtime вызывает `extractText(...)`
- результаты объединяются в одном search popup

### `api.assets`

```ts
pickImage(): Promise<string>
pickFile(config?: {
  title?: string
  accept?: string[]
  multiple?: boolean
}): Promise<string | string[] | null>
copyAsset(sourcePath: string, targetDir?: string): Promise<string>
copyImage(sourcePath: string, targetDir?: string): Promise<string>
saveImageBase64(fileName: string, base64: string, targetDir?: string): Promise<string>
readImageDataUrl(path: string): Promise<string>
```

Замечания:

- `pickFile(...)` требует permission `external`
- `pickImage()` отдельного permission не требует
- `copy*` и `saveImageBase64(...)` сохраняют файлы в workspace и возвращают относительный путь

### `api.process`

```ts
start(config: {
  command: string
  args?: string[]
  stdin?: string
  cwd: 'workspace'
  stdoutMode?: 'raw' | 'lines'
  stderrMode?: 'raw' | 'lines'
}): Promise<DesktopProcessHandle>
```

```ts
interface DesktopProcessHandle {
  id: string
  onEvent(callback: (event:
    | { type: 'stdout'; data: string }
    | { type: 'stderr'; data: string }
    | { type: 'exit'; code: number }
    | { type: 'error'; message: string }
  ) => void | Promise<void>): () => void
  cancel(): Promise<void>
}
```

Сейчас поддерживается только `cwd: 'workspace'`.

### `api.ui`

```ts
promptText(config: {
  title: string
  description?: string
  placeholder?: string
  submitLabel?: string
  initialValue?: string
  multiline?: boolean
}): Promise<string | null>

createTaskStatus(config: {
  title: string
  message?: string
  cancellable?: boolean
  onCancel?: () => void | Promise<void>
  surface?: 'floating' | 'workspace-banner'
  sessionId?: string
  scope?: 'workspace' | 'source-note'
}): PluginTaskStatusHandle

registerSidebarPanel(config: {
  id: string
  title: string
  render(container: HTMLElement): void
}): void

registerCommand(config: {
  id: string
  name: string
  hotkey?: string
  callback(): void | Promise<void>
}): void

registerPage(config: {
  id: string
  title: string
  mode: 'tab' | 'route'
  render(container: HTMLElement): void
  cleanup?(): void
}): void

registerFileViewer(config: PluginFileViewerConfig): void
registerSlashCommand(config: {
  id: string
  title: string
  description: string
  icon: string
  callback(): void | Promise<void>
}): void

registerContextMenuItem(config: {
  id: string
  label: string
  icon?: string
  filter?: (entry: { path: string; isDir: boolean }) => boolean
  callback(entry: { path: string; isDir: boolean }): void | Promise<void>
}): void

registerToolbarButton(config: {
  id: string
  label: string
  icon: string
  callback(): void | Promise<void>
}): void

registerSidebarButton(config: {
  id: string
  label: string
  icon: string
  callback(): void | Promise<void>
}): void

openPluginPage(pageId: string): void
openFile(path: string): void
openExternalUrl(url: string): void
notify(message: string, durationMs?: number): void
```

#### `registerFileViewer(...)`

Плагин может зарегистрировать либо:

- custom renderer
- host-editor viewer через конфиг `hostEditor`

Это позволяет встраивать как полностью собственный просмотрщик, так и host editor для нестандартного файла.

### `api.editor`

```ts
captureActiveSession(): Promise<EditorSession | null>
openSession(path: string): Promise<EditorSession>
listKinds(): EditorKindInfo[]
getCapabilities(kind: string): EditorKindCapabilities
mount(container: HTMLElement, config: EditorMountConfig): Promise<EditorHandle>
```

Editor sessions полезны для редактирования markdown без прямой привязки к DOM-редактору, а `mount(...)` нужен для встраивания host editor в plugin surface.

### `api.events`

```ts
on(
  event: 'workspace:path-renamed' | 'file-open' | 'file-save' | 'editor-change',
  callback: (payload: unknown) => void | Promise<void>,
): () => void
```

События:

- `workspace:path-renamed`
- `file-open`
- `file-save`
- `editor-change`

Подписки автоматически снимаются при unload плагина.

### `api.storage`

```ts
get(key: string): Promise<unknown>
set(key: string, value: unknown): Promise<void>
```

Storage сериализует значения в JSON и хранит их в `data.json`.

### `api.settings`

```ts
get<T = unknown>(key: string): Promise<T | undefined>
getAll(): Promise<Record<string, unknown>>
set(key: string, value: unknown): Promise<void>
onChange(callback: (event: {
  key: string
  value: unknown
  values: Record<string, unknown>
}) => void | Promise<void>): () => void
```

Важно:

- schema настроек объявляется в `manifest.json`, а не во время runtime
- host сам строит settings page по `manifest.settings.sections`
- страница настроек появляется в `Settings` только у включённого плагина
- значения хранятся в reserved storage key `__volt_plugin_settings__`

## Namespace и идентификаторы

Host namespaced-регистрирует plugin entities по шаблону:

```text
${pluginId}:${config.id}
```

Поэтому внутри `main.js` можно использовать короткие `id`, не боясь коллизий между разными плагинами.

## Минимальный пример

`manifest.json`:

```json
{
  "apiVersion": 4,
  "id": "active-file-info",
  "name": "Active File Info",
  "version": "1.0.0",
  "description": "Shows info about the active file",
  "main": "main.js",
  "permissions": ["read"]
}
```

`main.js`:

```js
(function () {
  api.ui.registerCommand({
    id: 'show-active-file-info',
    name: 'Show Active File Info',
    callback: async () => {
      const path = api.workspace.getActivePath();
      if (!path) {
        api.ui.notify('Open a file first.');
        return;
      }

      const content = await api.fs.read(path);
      api.ui.notify(`"${path}" contains ${content.length} characters.`, 4000);
    },
  });
})();
```

## Как установить плагин

Через интерфейс `Settings -> Plugins`:

1. выбрать ZIP-архив плагина
2. импортировать его в каталог `~/.volt/plugins`
3. подтвердить permissions при необходимости
4. включить плагин

Если у плагина нет дополнительных permissions, host может включить его сразу после успешного импорта.

## Как обновить плагин во время разработки

Простейший сценарий обновления без перезапуска приложения:

1. изменить `main.js`
2. выключить плагин
3. включить его снова

Это принудительно вызовет unload и повторную загрузку runtime.

## Где смотреть реализацию

- [`frontend/src/shared/lib/plugin-runtime/pluginApi.ts`](../frontend/src/shared/lib/plugin-runtime/pluginApi.ts)
- [`frontend/src/shared/lib/plugin-runtime/pluginApiFactory.ts`](../frontend/src/shared/lib/plugin-runtime/pluginApiFactory.ts)
- [`frontend/src/shared/lib/plugin-runtime/pluginLoader.ts`](../frontend/src/shared/lib/plugin-runtime/pluginLoader.ts)
- [`frontend/src/entities/plugin/model/pluginRegistry.ts`](../frontend/src/entities/plugin/model/pluginRegistry.ts)
- [`infrastructure/filesystem/plugin_store.go`](../infrastructure/filesystem/plugin_store.go)
- [`interfaces/wailshandler/plugin_handler.go`](../interfaces/wailshandler/plugin_handler.go)
- [`interfaces/wailshandler/plugin_process.go`](../interfaces/wailshandler/plugin_process.go)
