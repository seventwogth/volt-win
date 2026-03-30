# Релизы и GitHub Actions

## Где находится workflow

Автоматическая публикация релизов описана в [`.github/workflows/release.yml`](../.github/workflows/release.yml).

Workflow запускается на любой push тега:

```yaml
on:
  push:
    tags:
      - "*"
```

## Что делает pipeline

Pipeline состоит из двух jobs:

1. `build` — собирает приложение для трёх платформ и архивирует артефакты
2. `release` — скачивает собранные архивы и публикует GitHub Release

## Матрица сборки

- `Linux` — `ubuntu-24.04`, `linux/amd64`, c тегом `webkit2_41`
- `Windows` — `windows-latest`, `windows/amd64`
- `macOS` — `macos-15`, `darwin/universal`

## Артефакты релиза

- `volt-linux-amd64.tar.gz`
- `volt-windows-amd64.zip`
- `volt-macos-universal.zip`

## Используемые версии в CI

На текущий момент workflow пинит:

- Go `1.23.3`
- Node.js `20`
- Wails CLI `2.12.0`

Важно: это отличается от локального требования в `go.mod`, где сейчас указан Go `1.26`. Перед выпуском тега стоит проверить, что release workflow всё ещё совместим с текущим состоянием репозитория.

## Как выходит релиз

После `git push` тега GitHub Actions:

1. собирает приложение под каждую платформу
2. архивирует результат
3. создаёт GitHub Release, если его ещё нет
4. загружает артефакты в релиз через `gh release upload --clobber`

Пример:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Ограничения текущего workflow

- macOS-сборка не подписывается и не нотариализуется
- Windows-сборка не подписывается сертификатом
- Linux-сборка требует `libwebkit2gtk-4.1-dev` и использует тег `webkit2_41`

## Где лежат бинарники во время сборки

Wails складывает собранное приложение в `build/bin/`.

Далее workflow:

- для Linux архивирует весь `build/bin`
- для Windows архивирует содержимое `build/bin`
- для macOS архивирует `build/bin/volt.app`
