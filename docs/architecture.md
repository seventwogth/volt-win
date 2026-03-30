# Архитектура проекта

## Общая схема

Volt состоит из двух основных частей:

- backend на `Go`, который работает с локальной файловой системой, настройками и desktop runtime через `Wails`
- frontend на `React`, который рендерит интерфейс, редактор, поиск и plugin runtime

Связь между ними проходит через Wails bindings из `interfaces/wailshandler/`.

## Базовые термины

- `volt` — подключённое локальное хранилище, путь к которому знает приложение
- `workspace` — активный `volt`, открытый в интерфейсе
- `plugin runtime` — часть frontend, которая загружает плагины, создаёт для них ограниченный API и управляет их жизненным циклом

## Поток запроса

Типичный сценарий выглядит так:

1. Пользователь инициирует действие во frontend.
2. Frontend вызывает один из Wails handlers.
3. Handler делегирует выполнение в `commands.Manager`.
4. Команда обращается к инфраструктуре или доменным контрактам.
5. Результат возвращается во frontend и попадает в UI или store.

Для плагинов к этому добавляется промежуточный слой frontend runtime: плагин вызывает host API, а уже он при необходимости обращается к backend.

## Слои backend

- `core/` — доменные сущности, ошибки и контракты репозиториев
- `commands/` — use case-слой с конкретными командами
- `infrastructure/` — локальное хранение, файловая система и runtime bridge
- `interfaces/wailshandler/` — публичный API для frontend через Wails
- [`bootstrap/container.go`](../bootstrap/container.go) — ручная сборка зависимостей и bindings

Backend остаётся локальным: отдельной базы данных, HTTP API и фонового сервиса в проекте нет.

## Слои frontend

- `frontend/src/app/` — корневое приложение, роутинг и провайдеры
- `frontend/src/pages/` — страницы home, workspace и settings
- `frontend/src/widgets/` — крупные UI-блоки рабочей области
- `frontend/src/entities/` — store-ы и предметно-ориентированное состояние
- `frontend/src/features/` — пользовательские сценарии вроде поиска, статусов задач и настроек горячих клавиш
- `frontend/src/shared/lib/plugin-runtime/` — загрузка плагинов, host API, event bus, editor sessions и process manager

## Граница plugin runtime

Плагинная система работает поверх frontend, а не внутри backend:

- backend хранит плагины, читает `manifest.json`, загружает `main.js`, управляет `data.json` и запускает процессы
- frontend исполняет plugin JavaScript через `new Function('api', source)`
- все привилегированные действия проходят через ограниченный host API

Это разделение важно: plugin JS не получает прямой доступ к Go handlers, shell или внутренним store-ам приложения.

## Хранение данных

Приложение использует домашний каталог пользователя:

- `~/.volt/volts.json` — список подключённых хранилищ
- `~/.volt/plugins/` — каталог установленных плагинов
- `~/.volt/plugin-state.json` — включённые и выключенные плагины
- `~/.volt/plugins/<plugin-id>/data.json` — plugin-local storage

Сами заметки и остальные файлы остаются в выбранных пользователем каталогах.

## Основные точки входа

- [`main.go`](../main.go) — Wails app и desktop window configuration
- [`bootstrap/container.go`](../bootstrap/container.go) — wiring backend-команд и handlers
- [`frontend/src/app/routes/AppRouter.tsx`](../frontend/src/app/routes/AppRouter.tsx) — маршруты приложения
- [`frontend/src/shared/lib/plugin-runtime/pluginLoader.ts`](../frontend/src/shared/lib/plugin-runtime/pluginLoader.ts) — загрузка и выгрузка плагинов

## Ключевые сценарии

- управление списком volt-хранилищ
- операции с файлами внутри workspace
- создание и редактирование markdown-заметок
- глобальный поиск по markdown и форматам плагинов
- расширение UI и сценариев работы через плагины

Подробности по слоям вынесены в [`backend.md`](backend.md), [`frontend.md`](frontend.md) и [`plugins.md`](plugins.md).
