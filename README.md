# CRM ИТ Школы Ростелекома

CRM для системной работы ИТ Школы Ростелекома с вузами. Система объединяет справочники университетов и ИТ-продуктов, рабочие карточки взаимодействий, workflow, импорт из Excel, интеграции, отчёты, уведомления и аудит.

Проект — монорепозиторий с FastAPI-бэкендом, React-интерфейсом и инфраструктурой Docker Compose. Локальный контур запускается одной командой; production-контур собирает образы на сервере и отдаёт приложение через Caddy с HTTPS.

## Назначение

CRM заменяет разрозненные Excel-файлы, почту и переписку единым рабочим контуром. Для каждой связки видно, с каким вузом ведётся работа, какое ИТ-направление и продукт участвуют, кто отвечает, на каком этапе находится процесс, какие договоры и лицензии связаны с ним и кто изменял данные.

Основная сущность — карточка взаимодействия «вуз + ИТ-направление + ИТ-продукт». Повторный импорт не создаёт дубли: данные обновляются по бизнес-ключу, изменения фиксируются в аудите.

## Демо проект
https://crm.tgifts.space

### Данные для входа:
| Роль | Логин | Пароль |
|---|---|---|
| admin | admin@gmail.com | zVwUPx%$8ICZ*oDj |
| manager | manager@gmail.com | p8%LtS*hiG&WPZ4G |
| user | user@gmail.com | H9Supif#49RFvtgA | 

## Возможности

### Справочники и взаимодействия

- вузы с регионом, ИНН и внешним идентификатором;
- контактные лица с ФИО, должностью, email и телефоном;
- назначения КАМов на вузы по периодам без пересечений;
- справочники вендоров, ИТ-направлений и ИТ-продуктов;
- карточки с договором, лицензией, статусом передачи, ответственным и комментарием;
- workflow-этапы, разрешённые переходы, история и обязательные комментарии;
- файлы этапов, обсуждение и вложения сообщений (при включённом чате);
- поиск, фильтры, пагинация и мягкое удаление.

### Импорт и интеграции

Мастер Excel выполняет загрузку, сопоставление колонок, dry-run, подтверждение записи и итоговый отчёт. Проверяются размер и содержимое файла, обязательные поля, даты, сроки лицензий и дубли. Импорт идемпотентен, пустые значения не затирают существующие, запись транзакционна.

API содержит единый конвейер приёма из LMS и сайта на CMS Laravel: HTTP-загрузка с токеном и пагинацией, нормализация, сопоставление, upsert, постановка новых карточек на workflow, статистика и аудит. До передачи реального контракта используются JSON-фикстуры; соответствие полей описано в `backend/app/integrations/contract.py`.

### Интерфейс и эксплуатация

В интерфейсе есть обзор, взаимодействия, вузы, справочники, процессы, импорт, отчёты, сотрудники, аудит и встроенная помощь. Отчёты выгружаются в XLS/XLSX, PDF, CSV и JSON. Prometheus собирает метрики API, Grafana показывает доступность, RPS, 5xx, p95 и активные запросы. Email и Telegram подключаются опционально через outbox; в development письма перехватывает Mailpit.

## Роли и безопасность

Авторизация выполняется через Keycloak (OAuth2/OIDC, Bearer JWT), область видимости проверяется в репозиториях.

| Роль | Доступ |
|---|---|
| `user` | Закреплённые вузы, их карточки, workflow, файлы и обсуждения; общие карточки без ответственного. |
| `manager` | Все вузы и карточки, справочники, назначения, workflow, импорт, отчёты и уведомления. |
| `admin` | Возможности `manager`, пользователи, журнал аудита и административные операции. |

Доменные записи удаляются мягко (`deleted_at`). Изменения, чтение ПДн, импорт, экспорт, отказы в доступе и переходы workflow попадают в append-only аудит; ФИО, email и телефон в изменениях маскируются хешами.

## Архитектура

```text
Браузер → React SPA / nginx → FastAPI → PostgreSQL
                                  ├─ MinIO (файлы)
                                  ├─ Redis (опциональный кэш)
                                  └─ Keycloak (JWT/JWKS)

LMS / CMS ──► API integrations       API /metrics ──► Prometheus ──► Grafana
```

Браузер работает через один origin: nginx проксирует `/api` и `/kc`. Бизнес-правила находятся в сервисах, доступ к данным — в репозиториях, HTTP-контракты — в схемах FastAPI. PostgreSQL хранит данные и метаданные файлов, сами файлы — в закрытом бакете MinIO.

## Состав репозитория

```text
backend/     FastAPI, SQLAlchemy, Alembic, PostgreSQL — API и бизнес-логика
frontend/    React, TypeScript, Vite — интерфейс CRM
docker/      Keycloak, Caddy, Prometheus, Grafana и служебные файлы
docs/        архитектура, интеграции, эксплуатация, руководства и OpenAPI
archive/     примеры исходных файлов и данных для импорта
.github/     CI/CD: проверки, образы, публикация и деплой
```

## Быстрый запуск

Требуются Docker Engine и Docker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

Миграции Alembic и демо-данные применяются при старте API, если `SEED_ON_START=true`.

| Сервис | Адрес |
|---|---|
| Веб-интерфейс | <http://localhost:5173> |
| Swagger UI | <http://localhost:8000/docs> |
| ReDoc | <http://localhost:8000/redoc> |
| Health-check | <http://localhost:8000/health> |
| Keycloak | <http://localhost:8080> |
| Grafana | <http://localhost:3000> |
| Prometheus | <http://localhost:9090> |
| Mailpit | <http://localhost:8025> |
| MinIO Console | <http://localhost:9001> |

Локальные пользователи Keycloak: `kc-admin` / `admin123`, `kc-manager` / `manager123`, `kc-user` / `user123`. Эти пароли предназначены только для local/dev.

## Запуск отдельных приложений

### Бэкенд

Нужны Python 3.12 и PostgreSQL 16.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate                 # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload
```

Проверки: `pytest`, `ruff check .`, `ruff format --check .`, `mypy app`. OpenAPI экспортируется командой `python -m scripts.export_openapi`. При `AUTH_MODE=dev` для ручных запросов используется `X-Debug-User: seed-manager`; в production dev-auth запрещён.

### Фронтенд

Нужен Node.js 24.

```bash
cd frontend
npm ci
npm run dev
npm run lint
npm run build
```

Vite проксирует `/api` и `/kc`. Production Dockerfile собирает SPA и запускает nginx, а `API_ORIGIN` и `KEYCLOAK_ORIGIN` подставляются при старте контейнера.

## API

Базовый префикс — `/api/v1`.

| Группа | Назначение |
|---|---|
| `/universities`, `/university-contacts`, `/assignments` | вузы, контакты и назначения КАМов |
| `/vendors`, `/it-directions`, `/it-products` | справочники |
| `/interactions`, `/attachments` | карточки, переходы и файлы |
| `/workflows`, `/workflow-stages`, `/workflow-transitions` | процессы |
| `/imports` | загрузка и применение Excel |
| `/integrations` | синхронизации LMS/CMS |
| `/reports` | отчёты и статистика |
| `/communications` | чат, уведомления и каналы |
| `/users` | пользователи Keycloak |
| `/audit` | журнал изменений |

Полная схема опубликована в [docs/openapi.json](docs/openapi.json) и доступна в Swagger после запуска.

## Конфигурация

Все параметры находятся в `.env.example`, production-шаблон — `.env.server.example`. Основные группы: `POSTGRES_*`, `AUTH_MODE` и `KEYCLOAK_*`, `MINIO_*`, `CACHE_*` и `REDIS_URL`, `INTEGRATIONS_*`, `SMTP_*`, `FEATURE_*`, `IMPORT_*`. Реальные пароли, токены и ключи нельзя добавлять в Git. Внешние интеграции включайте только после согласования TLS/VPN/proxy и allowlist.

## Production и CI/CD

GitHub Actions параллельно проверяет бэкенд (`ruff`, `mypy`, `pytest`) и фронтенд (`npm ci`, `oxlint`, TypeScript и build). Deploy с `main` по SSH загружает исходный код `backend/` и `frontend/` на сервер, собирает там образы `api` и `web` командой Docker Compose, перезапускает стек и ждёт health-check.

`docker-compose.deploy.yml` размещает приложение за Caddy. Keycloak доступен на `https://DOMAIN/kc`, Grafana — через `GRAFANA_DOMAIN`; PostgreSQL, MinIO, Redis и Prometheus должны оставаться во внутренней сети. Перед эксплуатацией замените demo realm, вынесите секреты из Git, настройте резервное копирование PostgreSQL и MinIO и проверьте восстановление.

## Документация

| Документ | Содержание |
|---|---|
| [backend/README.md](backend/README.md) | модель данных, импорт, аудит, права и разработка |
| [frontend/README.md](frontend/README.md) | экраны, сборка и авторизация |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | архитектура |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | интеграции LMS и CMS |
| [docs/DEVELOPMENT_AND_DEPLOYMENT.md](docs/DEVELOPMENT_AND_DEPLOYMENT.md) | сборка и установка |
| [docs/SECURITY_AND_OPERATIONS.md](docs/SECURITY_AND_OPERATIONS.md) | ИБ и эксплуатация |
| [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) | руководство администратора |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | руководство пользователя |
| [docs/SMTP.md](docs/SMTP.md) | email и Mailpit |
| [docs/description.md](docs/description.md) | термины предметной области |
| [docs/TZ-IT-School-RTK.md](docs/TZ-IT-School-RTK.md) | исходное техническое задание |
| [docs/openapi.json](docs/openapi.json) | схема API |

## Ограничения и допущения

- реальные контракты LMS и CMS не переданы, поэтому по умолчанию используются fixtures;
- production realm Keycloak, сроки хранения, резервное копирование и сетевые allowlist требуют решения владельца;
- Redis, чат, уведомления и внешние каналы выключены по умолчанию;
- нагрузочные и независимые проверки безопасности выполняются в целевом контуре.
