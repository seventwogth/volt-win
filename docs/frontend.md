# Фронтенд

## Роль frontend

Frontend в Volt не ограничивается рендерингом экранов. Он одновременно:

- показывает основной UI приложения
- хранит клиентское состояние в `Zustand`
- управляет редактором на базе `Tiptap`
- работает как runtime-слой для плагинов
- объединяет core-поиск и search providers плагинов

Именно поэтому значимая часть архитектуры находится не только в страницах, но и в `entities/`, `features/` и `shared/lib/plugin-runtime/`.

## Стек

- `React 18`
- `TypeScript`
- `React Router 6`
- `Vite`
- `Sass Modules`
- `Zustand`
- `Tiptap`

## Точки входа

- [`frontend/src/main.tsx`](../frontend/src/main.tsx) — bootstrap React-приложения
- [`frontend/src/app/App.tsx`](../frontend/src/app/App.tsx) — корневое приложение и провайдеры
- [`frontend/src/app/routes/AppRouter.tsx`](../frontend/src/app/routes/AppRouter.tsx) — маршрутизация

## Основные маршруты

Маршруты описаны в [`frontend/src/app/routes/AppRouter.tsx`](../frontend/src/app/routes/AppRouter.tsx):

- `/` — домашняя страница
- `/workspace/:voltId` — активный workspace
- `/workspace/:voltId/plugin/:pageId` — маршрут полноэкранной страницы плагина
- `/settings` — общие настройки
- `/settings/shortcuts` — настройки горячих клавиш
- `/settings/plugins` — список плагинов
- `/settings/plugin/:pluginId` — host-rendered settings page плагина
- `/settings/about` — раздел About

## Основные страницы

- [`frontend/src/pages/home/HomePage.tsx`](../frontend/src/pages/home/HomePage.tsx) — список volt-хранилищ и создание нового подключения
- [`frontend/src/pages/workspace/WorkspacePage.tsx`](../frontend/src/pages/workspace/WorkspacePage.tsx) — рабочая область
- [`frontend/src/pages/workspace/PluginRoutePage.tsx`](../frontend/src/pages/workspace/PluginRoutePage.tsx) — полноэкранные страницы плагинов по отдельному маршруту
- [`frontend/src/pages/settings/SettingsPage.tsx`](../frontend/src/pages/settings/SettingsPage.tsx) — общий контейнер настроек

## Состояние приложения

Ключевые store-ы и runtime-модули:

- `voltStore` — список volt, загрузка, создание и удаление
- `workspaceStore` — открытые workspace-ы и активный `voltId`
- `tabStore` — file tabs и plugin tabs
- `fileTreeStore` — дерево файлов, inline rename/create/delete и drag-and-drop
- `pluginRegistry` — регистрации от плагинов: команды, страницы, sidebar, toolbar, file viewers и search providers
- `pluginLogStore` — runtime-ошибки и предупреждения плагинов
- `pluginSettingsStore` — значения host-rendered plugin settings
- `pluginPromptStore` — модальное окно текстового ввода для плагинов
- `pluginTaskStatusStore` — плавающие статусы и баннеры долгих задач
- `appSettingsStore` — общие настройки и горячие клавиши

## Рабочая область

Рабочий экран собирается из нескольких независимых блоков:

- `WorkspaceTabs` — верхняя панель открытых workspace-ов
- `WorkspaceShell` — каркас активного workspace
- `FileTree` — дерево файлов и каталогов
- `FileTabs` — вкладки открытых файлов
- `EditorPanel` — markdown-редактор
- `ImageViewer` и plugin file viewers — просмотр нестандартных форматов файлов
- `PluginPageHost` — контейнер plugin pages в табах
- `SearchPopup` — поиск и command palette

## Редактор и файл-ориентированные сценарии

Редактор построен на `Tiptap` и дополнен хостовой логикой:

- автосохранение находится в `useAutoSave`
- slash-меню объединяет built-in действия и plugin slash commands
- плагинам доступны editor sessions и host editors
- при изменениях file tree эмитит событие `workspace:path-renamed`, на которое могут подписываться плагины

Это позволяет держать основной markdown-редактор встроенным, а нестандартные сценарии подключать через runtime API.

## Поиск и command palette

Поисковый popup:

- открывается по `Mod+K`
- дополнительно поддерживает `Double Shift`
- переключается в режим command palette, если строка начинается с `>`
- объединяет backend search по `.md` и результаты плагинов через `search.registerTextProvider(...)`

Основная логика находится в [`frontend/src/features/workspace-search/useSearchPopup.ts`](../frontend/src/features/workspace-search/useSearchPopup.ts).

## Настройки

Раздел настроек состоит из нескольких экранов:

- general settings
- shortcut settings
- plugin catalog
- plugin settings pages
- about

Важно: host-rendered страница настроек плагина доступна только для включённого плагина, у которого есть `manifest.settings.sections`.

## Plugin runtime на стороне frontend

Ключевые runtime-модули:

- [`frontend/src/shared/lib/plugin-runtime/pluginLoader.ts`](../frontend/src/shared/lib/plugin-runtime/pluginLoader.ts) — загрузка и выгрузка плагинов
- [`frontend/src/shared/lib/plugin-runtime/pluginApiFactory.ts`](../frontend/src/shared/lib/plugin-runtime/pluginApiFactory.ts) — создание host API
- [`frontend/src/shared/lib/plugin-runtime/pluginApi.ts`](../frontend/src/shared/lib/plugin-runtime/pluginApi.ts) — публичные TypeScript-типы plugin API
- [`frontend/src/shared/lib/plugin-runtime/pluginEventBus.ts`](../frontend/src/shared/lib/plugin-runtime/pluginEventBus.ts) — отслеживаемые подписки
- [`frontend/src/shared/lib/plugin-runtime/editorSessionManager.ts`](../frontend/src/shared/lib/plugin-runtime/editorSessionManager.ts) — detached editor sessions
- [`frontend/src/shared/lib/plugin-runtime/hostEditorService.tsx`](../frontend/src/shared/lib/plugin-runtime/hostEditorService.tsx) — host editors и embedded mounts
- [`frontend/src/shared/lib/plugin-runtime/pluginProcessManager.ts`](../frontend/src/shared/lib/plugin-runtime/pluginProcessManager.ts) — process bridge

Во frontend также живёт `pluginRegistry`, куда плагины регистрируют:

- commands
- sidebar panels и sidebar buttons
- toolbar buttons
- plugin pages
- slash commands
- context menu items
- file viewers
- search providers

## Lifecycle плагинов

При открытии workspace frontend:

1. очищает предыдущий plugin runtime
2. загружает список плагинов из backend
3. оставляет только `enabled` плагины
4. загружает `main.js`
5. исполняет его с ограниченным объектом `api`

При выгрузке runtime снимает listeners, процессы, editor sessions, host editors, task statuses и регистрации плагинов.

Подробный контракт плагинов вынесен в [`plugins.md`](plugins.md).
