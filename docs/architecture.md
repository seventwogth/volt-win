# Архитектура проекта

## Общая схема

Проект разделен на бэкенд на `Go` и фронтенд на `React`, которые связываются через `Wails`.

Отдельно поверх core-логики работает plugin runtime:

- backend даёт инфраструктурные plugin handlers
- frontend загружает plugin JS, строит ограниченный API и монтирует plugin UI surfaces

Поток запроса выглядит так:

1. Пользовательское действие происходит во frontend.
2. Фронтенд вызывает метод Wails handler.
3. Handler делегирует работу в `commands.Manager`.
4. Команда обращается к инфраструктуре или доменным репозиториям.
5. Результат возвращается обратно во frontend.

## Бэкенд-слои

- `core/` содержит доменные сущности, ошибки и контракты репозиториев.
- `commands/` содержит команды, сгруппированные по доменным областям и system-сценариям.
- `infrastructure/` содержит конкретные реализации доступа к локальным данным и Wails runtime bridge.
- `interfaces/wailshandler/` публикует backend-функции во frontend через Wails и локализует ошибки.
- [`bootstrap/container.go`](../bootstrap/container.go) собирает зависимости приложения вручную.

## Хранение данных

- список подключенных volt хранится локально в `~/.volt/volts.json`
- сами заметки остаются в выбранных пользователем каталогах
- backend работает только с локальной файловой системой и не требует отдельной БД

## Ключевые сценарии

- управление volt-хранилищами
- чтение, запись, создание, удаление и переименование путей внутри workspace
- markdown-specific создание note и поиск по core-owned markdown
- расширение приложения через внешние плагины

## Plugin архитектура

Plugin flow в текущей реализации выглядит так:

1. Backend перечисляет плагины в `~/.volt/plugins`.
2. Frontend при входе в workspace вызывает `loadAllPlugins(voltPath)`.
3. Для каждого enabled plugin frontend загружает `main.js`, создаёт `api` и исполняет entry.
4. Плагин регистрирует команды, pages и другие UI surfaces в `pluginRegistry`.
5. При unload registry, listeners, runtime `settings.onChange` subscriptions и plugin tabs очищаются.

Важно:

- plugin JS работает во frontend runtime, а не в backend
- привилегированные действия даются только через host API
- long-running workflows строятся из generic `editor` sessions и `desktop.process`, а не из plugin-specific веток в core
- schema plugin settings объявляется declarative в `manifest.json`, а host рендерит отдельную settings page `/settings/plugin/:pluginId`
- settings pages не зависят от загруженного plugin runtime и доступны даже когда plugin disabled
- backend не знает о plugin-owned file formats
- plugin-owned search и best-effort rename rewrite реализуются через runtime V3
- frontend search popup объединяет core markdown results с plugin-owned results через зарегистрированные `search.registerFileTextProvider(...)`

Подробности и guide по созданию собственных плагинов находятся в [docs/plugins.md](plugins.md).
