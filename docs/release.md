# Релизы и GitHub Actions

## Где находится workflow

Автоматическая публикация релизов описана в [`.github/workflows/release.yml`](../.github/workflows/release.yml).

Workflow запускается на push тега:

```yaml
on:
  push:
    tags:
      - "*"
```

## Что делает pipeline

Pipeline состоит из двух jobs:

1. `build` собирает приложение для Linux, Windows и macOS.
2. `release` скачивает готовые архивы и публикует GitHub Release.

## Матрица сборки

- `Linux` - `ubuntu-24.04`, `linux/amd64`, с тегом `webkit2_41`
- `Windows` - `windows-latest`, `windows/amd64`
- `macOS` - `macos-15`, `darwin/universal`

## Артефакты релиза

- `volt-linux-amd64.tar.gz`
- `volt-windows-amd64.zip`
- `volt-windows-amd64-installer.exe`
- `volt-macos-universal.zip`

Для Windows в релизе публикуются два независимых артефакта:

- ZIP-архив с собранным `build/bin`
- NSIS installer `.exe` для обычной установки на Windows

## Подпись Windows-сборки

Подпись Windows-артефактов включается через секреты `WINDOWS_SIGNING_CERT_BASE64`, `WINDOWS_SIGNING_CERT_PASSWORD`
и переменную репозитория `WINDOWS_SIGNING_TIMESTAMP_URL`, которые подхватывает release workflow.

Если секреты для сертификата и подписи не заданы, сборка все равно проходит, но Windows installer и бинарники остаются unsigned.

Это сделано специально, чтобы:

- не ломать релизные сборки в forks и локальных CI-окружениях
- сохранить возможность выпускать артефакты без корпоративного сертификата

## Как выходит релиз

После `git push` тега GitHub Actions:

1. собирает приложение под каждую платформу
2. архивирует результат
3. создает GitHub Release, если его еще нет
4. загружает артефакты в релиз через `gh release upload --clobber`

Пример:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Ограничения текущего релизного контура

- Windows-сборка пока остается только `amd64`
- Подпись Windows-артефактов зависит от наличия secrets в GitHub Actions
- Windows installer требует WebView2 runtime через bootstrapper Wails
- macOS-сборка не подписывается и не нотариализуется
- Linux-сборка требует `libwebkit2gtk-4.1-dev` и использует тег `webkit2_41`

## Где лежат бинарники во время сборки

Wails складывает собранное приложение в `build/bin/`.

Далее workflow:

- для Linux архивирует весь `build/bin`
- для Windows архивирует `build/bin` в ZIP и отдельно публикует NSIS installer
- для macOS архивирует `build/bin/volt.app`
