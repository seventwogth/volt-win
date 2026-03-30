# Плагинная система Volt

## Что это такое

Плагины в Volt это внешние frontend-расширения, которые лежат в `~/.volt/plugins` и выполняются внутри desktop-приложения через ограниченный host API.

Плагин может:

- добавлять команды в command palette `>`
- добавлять slash-команды в редактор `/`
- добавлять plugin pages в виде workspace tab или отдельного route
- добавлять кнопки в sidebar rail, toolbar и file tree context menu
- добавлять sidebar panels
- объявлять schema настроек прямо в `manifest.json`, чтобы host рендерил отдельную settings page
- читать и писать файлы активного workspace через permission-guarded API
- работать с note sessions и anchor-ами через editor API
- запускать локальные процессы внутри активного workspace через desktop process broker

Плагин не получает прямой доступ к backend handler-ам, shell, файловой системе или внутренним store приложения. Все привилегированные действия идут только через объект `api`, который создаёт host app.

## Где живут плагины

Host app использует домашний каталог пользователя:

- каталог плагинов: `~/.volt/plugins`
- файл enabled-state: `~/.volt/plugin-state.json`
- plugin-local storage: `~/.volt/plugins/<plugin-id>/data.json`

Каждый плагин это отдельная папка:

```text
~/.volt/plugins/my-plugin/
  manifest.json
  main.js
  data.json
```

`data.json` создаётся host app автоматически, когда плагин впервые вызывает `api.storage.set(...)`.

Дополнительно host сам резервирует внутри plugin data ключ:

- `__volt_plugin_settings__` - flat-object для `api.settings`

## Жизненный цикл

### Обнаружение

Backend перечисляет подпапки внутри `~/.volt/plugins`, читает `manifest.json` и строит список установленных плагинов.

### Включение

При включении плагина в Settings:

- его состояние записывается в `~/.volt/plugin-state.json`
- если есть активный workspace, frontend сразу вызывает `loadSinglePlugin(pluginId, voltPath)`
- если активного workspace нет, плагин просто помечается как enabled и реально загрузится при следующем открытии workspace

### Загрузка

При открытии workspace frontend вызывает `loadAllPlugins(voltPath)`:

1. очищает registry, tracked listeners, plugin-owned sessions и активные process runs
2. получает список enabled plugins
3. загружает `main.js` через backend
4. исполняет entry через `new Function('api', source)`
5. передаёт в него host API, уже привязанный к `pluginId`, `voltPath` и declared permissions

### Выгрузка

`unloadSinglePlugin(pluginId)`:

- снимает tracked listeners из plugin event bus
- отменяет plugin-owned desktop processes
- dispose-ит plugin-owned editor sessions
- удаляет все registrations из registry
- вызывает `cleanup()` у удаляемых plugin pages
- закрывает plugin tabs этого плагина
- очищает runtime listeners для `settings.onChange(...)`

### Ошибки

Host runtime оборачивает init и callbacks в safe wrappers:

- ошибка попадает в `pluginLogStore`
- показывается toast
- подробности уходят в `console.error`

Лог доступен на отдельной settings page конкретного плагина.

## Версия API

Текущий контракт это **Plugin Runtime V3**.

Важно:

- старого `api.agent` больше нет
- старых helper-ов `editor.getContent()` и `editor.insertAtCursor()` больше нет
- для работы с заметками теперь используется session-based editor API
- для long-running local tasks теперь используется generic `desktop.process`
- plugin-owned file formats больше не реализуются в backend core
- поиск по plugin-owned форматам делается через `api.search.registerFileTextProvider(...)`
- best-effort rewrite после rename/move приходит через typed событие `workspace:path-renamed`

## Формат плагина

### `manifest.json`

Минимальный manifest:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Short plugin description",
  "main": "main.js",
  "permissions": ["read", "write"],
  "settings": {
    "sections": [
      {
        "id": "general",
        "title": "General",
        "fields": [
          {
            "key": "targetPath",
            "type": "text",
            "label": "Target path",
            "defaultValue": "notes/example.md"
          }
        ]
      }
    ]
  }
}
```

Поля:

- `id`: стабильный идентификатор плагина
- `name`: отображаемое имя в Settings
- `version`: версия плагина
- `description`: короткое описание
- `main`: entry file, обычно `main.js`
- `permissions`: список разрешений
- `settings`: optional declarative schema для host-rendered plugin settings page

### `main.js`

Volt исполняет entry как обычный JavaScript-файл и передаёт переменную `api`.

Минимальный пример:

```js
api.ui.registerCommand({
  id: 'hello',
  name: 'Hello command',
  callback: () => {
    api.ui.showNotice('Hello from plugin');
  },
});
```

Важно:

- runtime не собирает зависимости автоматически
- если плагину нужны внешние библиотеки, их нужно заранее bundle-ить в standalone `main.js`
- plugin code должен быть self-contained и готовым к выполнению в browser runtime внутри приложения

## Permissions

Текущие permissions:

- `read`
- `write`
- `editor`
- `process`

Что они дают:

- `read`: `volt.read`, `volt.list`, `volt.getActivePath`, `search.registerFileTextProvider`, `media.readImageDataUrl`
- `write`: `volt.write`, `volt.createFile`, `media.copyImage`, `media.saveImageBase64`
- `editor`: `editor.captureActiveSession`, `editor.openSession`
- `process`: `desktop.process.start`

UI методы (`ui.register*`, `ui.promptText`, `ui.createTaskStatus`, `ui.showNotice`), `events.on(...)`, `storage.*` и `settings.*` не требуют отдельного permission.

Если плагин вызывает API без нужного permission:

- действие блокируется
- в plugin log пишется ошибка
- пользователю показывается toast

## Public API

Ниже описан runtime API, который получает каждый плагин.

### `api.volt`

```ts
read(path: string): Promise<string>
write(path: string, content: string): Promise<void>
createFile(path: string, content?: string): Promise<void>
list(dirPath?: string): Promise<FileEntry[]>
getActivePath(): string | null
```

Поведение:

- все пути относительные к активному `voltPath`
- backend file repository дополнительно защищает операции от path traversal
- `list()` возвращает рекурсивное дерево без hidden files и directories

### `api.search`

```ts
registerFileTextProvider(config: {
  id: string
  extensions: string[]
  extractText(input: { filePath: string; content: string }): string | Promise<string>
}): void
```

Поведение:

- provider регистрируется host-side и ownership привязывается к `pluginId`
- registration требует permission `read`
- backend по-прежнему ищет только по markdown
- frontend search popup сам читает файлы заявленных extensions, вызывает `extractText(...)` и добавляет name/content matches
- merge происходит по общей семантике: сначала `isName`, затем content matches, с общим лимитом `50`

### `api.ui`

#### Prompt modal

```ts
promptText(config: {
  title: string
  description?: string
  placeholder?: string
  submitLabel?: string
  initialValue?: string
  multiline?: boolean
}): Promise<string | null>
```

Host-side modal:

- возвращает `null` на cancel
- возвращает trimmed строку на submit
- блокирует submit для пустого значения

#### Task status

```ts
createTaskStatus(config: {
  title: string
  message?: string
  cancellable?: boolean
  onCancel?: () => void | Promise<void>
  surface?: 'floating' | 'workspace-banner'
  sessionId?: string
  scope?: 'workspace' | 'source-note'
}): {
  setMessage(message: string): void
  markSuccess(message?: string): void
  markError(message: string): void
  markCancelled(message?: string): void
  close(): void
}
```

Это host-managed status surface для long-running plugin workflows.

Поведение:

- `surface: 'floating'` показывает отдельную persistent карточку поверх app shell
- `surface: 'workspace-banner'` рендерит banner внутри рабочей области редактора
- `scope: 'source-note'` показывает banner только у заметки, из которой был создан task
- `scope: 'workspace'` показывает banner во всей workspace области
- `running` состояние показывает spinner и optional `Cancel`
- terminal states авто-скрываются через короткий timeout
- status item автоматически закрывается при unload/disable плагина

#### Команды и панели

```ts
registerCommand(config: {
  id: string
  name: string
  hotkey?: string
  callback: () => void | Promise<void>
}): void

registerSidebarPanel(config: {
  id: string
  title: string
  render: (container: HTMLElement) => void
}): void
```

- `registerCommand` добавляет команду в palette `>`
- `registerSidebarPanel` добавляет панель в широкую часть sidebar

#### Plugin pages

```ts
registerPluginPage(config: {
  id: string
  title: string
  mode: 'tab' | 'route'
  render: (container: HTMLElement) => void
  cleanup?: () => void
}): void

openPluginPage(pageId: string): void
openFile(path: string): void
```

Поведение:

- `mode: 'tab'` открывает plugin page как workspace tab
- `mode: 'route'` открывает `/workspace/:voltId/plugin/:pageId`
- `cleanup` вызывается при unmount и при unload
- `openFile(path)` открывает указанный файл в обычном workspace tab, включая plugin-owned viewer-ы

#### Slash-команды

```ts
registerSlashCommand(config: {
  id: string
  title: string
  description: string
  icon: string
  callback: () => void | Promise<void>
}): void
```

Host сам удаляет `/query` range перед вызовом plugin callback.

#### Context menu

```ts
registerContextMenuItem(config: {
  id: string
  label: string
  icon?: string
  filter?: (entry: { path: string; isDir: boolean }) => boolean
  callback: (entry: { path: string; isDir: boolean }) => void | Promise<void>
}): void
```

Элементы появляются в file tree context menu после built-in `Delete`.

#### Toolbar и sidebar buttons

```ts
registerToolbarButton(config: {
  id: string
  label: string
  icon: string
  callback: () => void | Promise<void>
}): void

registerSidebarButton(config: {
  id: string
  label: string
  icon: string
  callback: () => void | Promise<void>
}): void
```

#### Notices

```ts
showNotice(message: string, durationMs?: number): void
```

Показывает обычный toast.

### `api.editor`

Editor API построен вокруг **note sessions**. Session это стабильный public handle для конкретной заметки, который живёт независимо от активного таба.

```ts
captureActiveSession(): Promise<EditorSession | null>
openSession(path: string): Promise<EditorSession>
```

`captureActiveSession()` возвращает session текущей открытой заметки или `null`, если активного note editor сейчас нет.

`openSession(path)` открывает session для конкретной заметки по относительному path внутри текущего workspace.

#### `EditorSession`

```ts
interface EditorSession {
  id: string
  filePath: string
  getMarkdown(): string
  save(): Promise<void>
  dispose(): void
  onDidChange(callback: () => void | Promise<void>): () => void
  getSelection(): { from: number; to: number }
  createAnchor(options?: {
    from?: number
    to?: number
    bias?: 'start' | 'end'
  }): string
  getAnchorRange(anchorId: string): { from: number; to: number } | null
  insertAtAnchor(anchorId: string, text: string): void
  replaceRange(range: { from: number; to: number }, text: string): void
  removeAnchor(anchorId: string): void
}
```

Семантика:

- offsets и ranges работают в markdown offsets, а не в ProseMirror positions
- anchor-ы remap-ятся host-side при изменениях документа
- если заметка активна, session синхронизируется с живым editor
- если пользователь ушёл на другой tab, session остаётся валидной и продолжает жить как detached markdown buffer
- `save()` записывает текущее состояние session в файл
- `dispose()` освобождает session и её anchor-ы

Эта модель нужна для long-running plugin workflows, которые должны продолжать работу даже если пользователь переключился на другой файл.

### `api.desktop.process`

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

`desktop.process` это generic desktop bridge для локальных процессов.

Ограничения:

- shell wrapping не используется
- `cwd` сейчас поддерживает только `'workspace'`
- host broker не даёт произвольный cwd и не открывает прямой shell access
- все process runs привязаны к plugin ownership и отменяются при unload/disable

#### `DesktopProcessHandle`

```ts
interface DesktopProcessHandle {
  id: string
  onEvent(callback: (event: DesktopProcessEvent) => void | Promise<void>): () => void
  cancel(): Promise<void>
}

type DesktopProcessEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string }
```

Mode-ы:

- `raw`: события приходят chunk-ами как прочитаны из stream
- `lines`: события приходят построчно, без завершающего `\n`

`error` используется для broker/start/stream failures. Ненулевой exit code приходит через обычное событие `exit`.

### `api.events`

```ts
on('file-open', callback: (filePath: string) => void | Promise<void>): () => void
on('file-save', callback: (filePath: string) => void | Promise<void>): () => void
on('editor-change', callback: () => void | Promise<void>): () => void
on('workspace:path-renamed', callback: (payload: {
  oldPath: string
  newPath: string
  isDir: boolean
}) => void | Promise<void>): () => void
```

Сейчас core испускает такие события:

- `file-open`
- `file-save`
- `editor-change`
- `workspace:path-renamed`

Host автоматически трекает эти listeners по `pluginId` и снимает их при unload.

### `api.storage`

```ts
get(key: string): Promise<unknown>
set(key: string, value: unknown): Promise<void>
```

Storage сериализует значения в JSON и хранит их в plugin-local `data.json`.

### `api.settings`

`api.settings` больше не описывает schema UI во время runtime. Источник правды для settings теперь находится в `manifest.json -> settings.sections`, а сам namespace нужен только для чтения, записи и live apply уже объявленных полей.

Плагин может:

- читать merged settings values
- менять их программно
- подписываться на live updates

Host app:

- строит settings page плагина из `manifest.settings.sections`
- показывает её как отдельный top-level пункт в `Settings`
- даёт доступ к этой странице даже если plugin disabled и даже без открытого workspace
- хранит значения в reserved key `__volt_plugin_settings__`

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

#### Settings schema в `manifest.json`

V1 поддерживает только host-rendered field types:

- `toggle`
- `text`
- `textarea`
- `number`
- `select`

Общие поля:

- `key`
- `type`
- `label`
- `description?`
- `defaultValue`

Дополнительно:

- `text` / `textarea`: `placeholder?`
- `number`: `min?`, `max?`, `step?`
- `select`: `options: Array<{ label: string; value: string }>`

Поведение:

- `key` должен быть уникален внутри плагина
- при duplicate key host логирует ошибку и игнорирует повторные поля
- `get()` и `getAll()` возвращают merged values: stored values поверх `defaultValue`
- для `number` host валидирует и clamp-ит значения по `min/max`
- invalid `select` fallback-ится на `defaultValue`
- `set()` сразу сохраняет данные в reserved key `__volt_plugin_settings__`
- settings pages полностью host-rendered, custom runtime settings pages больше не используются
- ошибки в `onChange(...)` попадают в plugin log через safe wrappers

## Namespace и идентификаторы

Все registrations namespaced host-side как:

```text
${pluginId}:${config.id}
```

Поэтому внутри самого плагина можно использовать короткие `id`, не боясь коллизий с другими расширениями.

## Как создать свой плагин

### 1. Создайте папку

```text
~/.volt/plugins/my-plugin/
```

### 2. Добавьте `manifest.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Example Volt plugin",
  "main": "main.js",
  "permissions": ["read"],
  "settings": {
    "sections": [
      {
        "id": "general",
        "title": "General",
        "description": "Example plugin settings",
        "fields": [
          {
            "key": "inboxPath",
            "type": "text",
            "label": "Inbox path",
            "defaultValue": "inbox/example.md"
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

### 3. Напишите `main.js`

Пример полезного минимального плагина:

```js
(function () {
  api.ui.registerCommand({
    id: 'open-active-file-info',
    name: 'Show Active File Info',
    callback: async () => {
      const path = api.volt.getActivePath();
      if (!path) {
        api.ui.showNotice('Open a note first.');
        return;
      }

      const content = await api.volt.read(path);
      api.ui.showNotice(`"${path}" has ${content.length} characters.`, 4000);
    },
  });
})();
```

### 4. Настройте и включите плагин

В `Settings`:

- на странице `Plugins` плагин можно включить или выключить
- если в manifest есть `settings.sections`, у плагина появляется отдельный top-level пункт в левом меню
- эту settings page можно открыть и настроить даже до включения плагина

### 5. Используйте hot reload через toggle

Текущий способ перезагрузить плагин без перезапуска приложения:

1. измените `main.js`
2. выключите плагин
3. включите его снова

Host вызовет `unloadSinglePlugin(...)`, снимет listeners/processes/sessions и загрузит новую версию.

## Примеры паттернов

### Команда + plugin page

```js
(function () {
  api.ui.registerPluginPage({
    id: 'hello-page',
    title: 'Hello',
    mode: 'tab',
    render(container) {
      container.innerHTML = '<div style="padding: 16px;">Hello from plugin page.</div>';
    },
  });

  api.ui.registerCommand({
    id: 'open-hello-page',
    name: 'Open Hello Page',
    callback() {
      api.ui.openPluginPage('hello-page');
    },
  });
})();
```

### Manifest settings + live apply

`manifest.json`:

```json
{
  "settings": {
    "sections": [
      {
        "id": "example",
        "title": "Example plugin",
        "fields": [
          {
            "key": "inboxPath",
            "type": "text",
            "label": "Inbox path",
            "defaultValue": "inbox/example.md"
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

`main.js`:

```js
(function () {
  api.settings.onChange((event) => {
    console.log('New plugin settings snapshot:', event.values);
  });
})();
```

### Работа с detached note session

```js
async function appendTextToCurrentNote(text) {
  const session = await api.editor.captureActiveSession();
  if (!session) {
    api.ui.showNotice('Open a note first.');
    return;
  }

  const anchorId = session.createAnchor({ bias: 'end' });
  session.insertAtAnchor(anchorId, text);
  await session.save();
  session.removeAnchor(anchorId);
  session.dispose();
}
```

### Запуск локального процесса

```js
async function runWorkspaceProcess() {
  const handle = await api.desktop.process.start({
    command: 'git',
    args: ['status', '--short'],
    cwd: 'workspace',
    stdoutMode: 'lines',
    stderrMode: 'lines',
  });

  const lines = [];
  handle.onEvent((event) => {
    if (event.type === 'stdout') {
      lines.push(event.data);
    }
    if (event.type === 'exit') {
      api.ui.showNotice(`Process finished with code ${event.code}`);
    }
  });
}
```

## Полезные замечания

- plugin pages должны сами чистить DOM listeners, таймеры и подписки в `cleanup()`
- callbacks лучше делать короткими, а длинные процессы переводить в `desktop.process`
- если нужен доступ к активной заметке во время долгого workflow, используйте `EditorSession`, а не `volt.getActivePath()`
- для UI иконок используйте существующие icon names из host app; неизвестная иконка будет автоматически заменена на `file`
- если плагин пишет в note session по частям, не забывайте вызывать `dispose()`
- если plugin использует `api.settings`, объявляйте schema в `manifest.json`, а не пытайтесь рисовать settings UI из runtime

## Где смотреть реализацию

Основные runtime-узлы:

- [`frontend/src/shared/lib/plugin-runtime/pluginLoader.ts`](../frontend/src/shared/lib/plugin-runtime/pluginLoader.ts)
- [`frontend/src/shared/lib/plugin-runtime/pluginApiFactory.ts`](../frontend/src/shared/lib/plugin-runtime/pluginApiFactory.ts)
- [`frontend/src/entities/plugin/model/pluginRegistry.ts`](../frontend/src/entities/plugin/model/pluginRegistry.ts)
- [`frontend/src/shared/lib/plugin-runtime/pluginEventBus.ts`](../frontend/src/shared/lib/plugin-runtime/pluginEventBus.ts)
- [`frontend/src/entities/plugin/model/pluginSettingsStore.ts`](../frontend/src/entities/plugin/model/pluginSettingsStore.ts)
- [`frontend/src/shared/lib/plugin-runtime/editorSessionManager.ts`](../frontend/src/shared/lib/plugin-runtime/editorSessionManager.ts)
- [`frontend/src/shared/lib/plugin-runtime/pluginProcessManager.ts`](../frontend/src/shared/lib/plugin-runtime/pluginProcessManager.ts)
- [`commands/system/plugin_process.go`](../commands/system/plugin_process.go)
- [`interfaces/wailshandler/plugin_process.go`](../interfaces/wailshandler/plugin_process.go)

Реальные примеры runtime plugins:

- [`/Users/docup/.volt/plugins/quick-capture/main.js`](/Users/docup/.volt/plugins/quick-capture/main.js)
- [`/Users/docup/.volt/plugins/qwen-inline/main.js`](/Users/docup/.volt/plugins/qwen-inline/main.js)
- [`/Users/docup/.volt/plugins/graph-view/main.js`](/Users/docup/.volt/plugins/graph-view/main.js)
