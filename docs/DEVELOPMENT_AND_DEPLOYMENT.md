# Сопроводительная документация

## Состав решения

CRM состоит из React SPA (`frontend`), FastAPI (`backend`), PostgreSQL,
Keycloak, MinIO и опционального Redis. Docker Compose поднимает полный локальный
контур; production-развёртывание и требования к защищённому контуру описаны
ниже и в `SECURITY_AND_OPERATIONS.md`.

## Локальный deploy

Локальный контур собирается из исходников через `docker-compose.yml`. Нужен
Docker Desktop или Docker Engine с Compose v2. Команды ниже безопасны для
повторного запуска: volumes не удаляются, поэтому данные PostgreSQL и MinIO
сохраняются.

PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose -f docker-compose.yml config -q
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
Invoke-WebRequest http://localhost:8000/health
```

Bash:

```bash
test -f .env || cp .env.example .env
docker compose -f docker-compose.yml config -q
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl --fail http://localhost:8000/health
```

После успешного запуска веб-интерфейс доступен на `http://localhost:5173`,
API/Swagger — на `http://localhost:8000/docs`, Keycloak — на
`http://localhost:8080`, Grafana — на `http://localhost:3000`, Mailpit — на
`http://localhost:8025`. Миграции выполняются при старте API. Логи и остановка:

```bash
docker compose logs -f api web
docker compose down                 # остановить, сохранив volumes
docker compose down --volumes       # полный сброс локальных данных
```

`down --volumes` удаляет локальную БД, файлы MinIO, Redis и мониторинг; эту
команду не следует использовать на сервере.

Локальная проверка частей проекта:

```bash
cd backend
pytest
ruff check .
ruff format --check .
mypy app

cd ../frontend
npm ci
npm run lint
npm run build
```

## Production deploy

Production-контур запускается из `docker-compose.deploy.yml`. В отличие от
локального Compose, API и web не собираются на сервере: они должны быть
опубликованы в GHCR. Серверу нужны Docker Compose v2, DNS-записи для
`DOMAIN`, `KEYCLOAK_DOMAIN` и `GRAFANA_DOMAIN`, открытые только порты 80/443 и
файл `.env` с правами `0600`, созданный из `.env.server.example`.

В каталоге `/opt/lct-crm` также должны находиться `docker-compose.deploy.yml` и
каталог `docker/` (Caddyfile, realm Keycloak и конфигурация мониторинга). Их
передаёт job `deploy` из GitHub Actions; при ручном запуске скопируйте эти файлы
из того же commit, что и выбранные образы.

Перед первым запуском на сервере:

```bash
mkdir -p /opt/lct-crm
cd /opt/lct-crm
cp .env.server.example .env
chmod 600 .env
# Заполнить .env: пароли, домены, API_IMAGE, WEB_IMAGE и IMAGE_TAG.
# API_IMAGE и WEB_IMAGE имеют вид ghcr.io/<owner>/<repo>/{api,web}.
docker login ghcr.io
```

Проверить итоговую конфигурацию до запуска:

```bash
docker compose -f docker-compose.deploy.yml --env-file .env config -q
docker compose -f docker-compose.deploy.yml --env-file .env pull
```

Рекомендуемый порядок ручного deploy повторяет порядок CI/CD и позволяет
локализовать ошибку по сервису:

```bash
set -a
. ./.env
set +a
compose=(docker compose -f docker-compose.deploy.yml --env-file .env)

"${compose[@]}" up -d --no-build --force-recreate db minio redis mailpit
"${compose[@]}" up -d --no-build --force-recreate keycloak
"${compose[@]}" run --rm keycloak-bootstrap
"${compose[@]}" up -d --no-build --no-deps --force-recreate api web
"${compose[@]}" up -d --no-build --force-recreate prometheus grafana

# Caddy занимает 80/443; перед запуском нужно остановить старый host-level Caddy.
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy; then
  sudo systemctl disable --now caddy
fi
"${compose[@]}" up -d --no-build --no-deps --force-recreate caddy

"${compose[@]}" ps
curl --fail https://"$DOMAIN"/health
```

В `.env` следует фиксировать тег успешно проверенного релиза (`IMAGE_TAG=sha-...`).
После deploy проверьте `docker compose ... ps`, health-check `crm-api` и
`crm-web`, HTTPS на `DOMAIN`, вход через `https://DOMAIN/kc` и dashboard на
`GRAFANA_DOMAIN`. Volumes не удаляются: они содержат БД, файлы MinIO, TLS
сертификаты Caddy и историю мониторинга.

Откат выполняется выбором предыдущего `IMAGE_TAG` в `.env`, повторным `pull` и
тем же staged deploy. Не используйте `docker compose down --volumes` на сервере.

Для штатного deploy с GitHub Actions достаточно запушить изменения в `main`
или запустить workflow вручную. Job `publish` собирает и публикует `api` и
`web`, а job `deploy` по SSH копирует compose/конфигурацию, выполняет staged
deploy и ждёт health-check. В environment `test` должны быть настроены
`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_PATH`,
`DEPLOY_KNOWN_HOSTS`, `DEPLOY_REGISTRY_USERNAME` и `DEPLOY_REGISTRY_TOKEN`.
Для настоящего production сначала выполните требования из
`SECURITY_AND_OPERATIONS.md`: production realm Keycloak, секреты, резервное
копирование, сетевые ограничения и согласование интеграций.

## Обработка данных

Данные проходят только через сервисный слой. Каталоги нормализуются и ищутся
по бизнес-ключам, поэтому импорт и интеграции используют одни правила.
Пустое значение во входящих данных означает «нет данных» и не перезаписывает
уже заполненное поле. Импорт сначала выполняет проверку и предпросмотр, затем
подтверждённая запись выполняется транзакционно.

Права применяются не только в интерфейсе: репозитории ограничивают запросы
областью видимости пользователя. Все таблицы предметной области используют
мягкое удаление и автоматический аудит. ФИО, email и телефон маскируются в
аудит-логе. Файлы проверяются по сигнатуре, а не по имени, и хранятся в MinIO;
в PostgreSQL остаются метаданные и ключ объекта.

## Ограничения и допущения

- Реальные контракты LMS и сайта не переданы: текущий режим использует
  демонстрационные данные, детали — в `INTEGRATIONS.md`.
- Сроки хранения import-строк и файлов, очистка MinIO и политика резервного
  копирования должны быть утверждены владельцем данных.
- Production realm Keycloak, allowlist, VPN/proxy/mTLS и параметры закрытого
  контура требуют заполнения заказчиком до ввода в эксплуатацию.
- Чат, уведомления, внешние каналы и кэш управляются feature flags и по
  умолчанию выключены.

## Эксплуатация

Проверяйте `/health` и health-check контейнеров. Журнал изменений доступен
администратору в приложении. Для миграции старых workflow-вложений в MinIO
запускайте из `backend`: `python -m scripts.migrate_attachment_blobs`.
