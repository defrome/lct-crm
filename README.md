# CRM ИТ Школы Ростелекома

Система контроля взаимодействия с вузами по ИТ-направлениям. Монорепозиторий:
бэкенд на FastAPI и веб-интерфейс на React поднимаются одной командой.

```bash
cp .env.example .env
docker compose up --build
```

| Что | Где |
|---|---|
| Веб-интерфейс | <http://localhost:5173> |
| Swagger UI | <http://localhost:8000/docs> |
| Keycloak | <http://localhost:8080> (admin / admin) |
| Grafana | <http://localhost:3000> (admin / admin) |
| Prometheus | <http://localhost:9090> |
| MinIO Console | <http://localhost:9001> (см. `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`) |

Миграции и демо-данные применяются автоматически при старте контейнера. Загруженные
Excel-файлы и вложения workflow сохраняются в бакете MinIO `crm-files`; данные MinIO
лежат в отдельном Docker volume.
Тестовые учётки Keycloak: `kc-admin` / `admin123`, `kc-manager` / `manager123`,
`kc-user` / `user123`.

---

## Структура репозитория

```
backend/     FastAPI, PostgreSQL, Alembic — API, импорт, workflow, интеграции
frontend/    React + Vite + Tailwind — веб-интерфейс, nginx в продакшене
docker/      инфраструктура compose: Caddy, Keycloak realm, Prometheus, Grafana
docs/        ТЗ, бэклог, документация по интеграциям, выгрузка OpenAPI
.github/     CI/CD: проверки, сборка образов, деплой
```

У каждого приложения свой `Dockerfile` и свой README:
**[backend/README.md](backend/README.md)** — модель данных, импорт, workflow, аудит,
права доступа; **[frontend/README.md](frontend/README.md)** — экраны и сборка.

---

## Разработка

Приложения разрабатываются по отдельности, а собираются вместе.

**Бэкенд** (нужен PostgreSQL 16):

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head && python -m scripts.seed
uvicorn app.main:app --reload

pytest && ruff check . && mypy app
```

**Фронтенд** (нужен Node 24):

```bash
cd frontend
npm ci
npm run dev        # Vite проксирует /api и /kc на поднятый бэкенд
npm run lint && npm run build
```

Конфигурация читается из одного `.env` в корне: бэкенд ищет его и там, и рядом с
собой, поэтому копий, которые разъезжаются, не появляется.

---

## Сборка и поставка

`docker compose up --build` собирает оба образа из исходников и поднимает весь
контур: база, Keycloak, API, веб-интерфейс, Prometheus, Grafana.

В продакшене образы не собираются на сервере — они приезжают из GHCR:

```
ghcr.io/<owner>/<repo>/api    бэкенд
ghcr.io/<owner>/<repo>/web    веб-интерфейс
```

`docker-compose.deploy.yml` разворачивает их за Caddy, который терминирует TLS.
Доменов по-прежнему три: `DOMAIN` — приложение целиком, `KEYCLOAK_DOMAIN` и
`GRAFANA_DOMAIN` — как раньше. Переменные сервера — в `.env.server.example`.

На `DOMAIN` Caddy отдаёт контейнер веб-интерфейса, а nginx внутри него разводит
запросы дальше:

| Путь | Куда идёт |
|---|---|
| `/` и любой неизвестный путь | SPA (клиентский роутинг) |
| `/assets/…` | статика сборки |
| `/api/…` | API |
| `/docs`, `/redoc`, `/openapi.json`, `/health` | API |
| `/kc/…` | Keycloak |

Keycloak can generate canonical login-page links such as `/resources/…` and
`/realms/…` without the `/kc` prefix when its public hostname is the main
application domain. Caddy routes those paths directly to Keycloak, so they do
not fall through to the SPA and are returned with their correct MIME types.

Отдельный домен под фронтенд не нужен, а браузер обращается только к одному
origin — у API нет CORS, и в realm Keycloak прописан один web origin.

---

## CI/CD

`.github/workflows/deploy.yml`, запускается на push в `main` и на pull request.

| Задача | Что делает |
|---|---|
| **Backend checks** | `ruff check`, `ruff format --check`, `mypy`, `pytest` на живом PostgreSQL |
| **Frontend checks** | `npm ci`, `oxlint`, `tsc -b && vite build` — проверка типов и сборка одним шагом |
| **Publish** | Матрицей собирает и пушит в GHCR два образа: `api` и `web`, с раздельным кэшем слоёв |
| **Deploy** | Только с `main`: копирует файлы поставки на сервер, тянет оба образа, поднимает и ждёт, пока оба контейнера станут `healthy` |

Проверки обоих приложений идут параллельно; публикация начинается, только если
зелёные оба. Сборка образа использует ту же команду, что и проверка типов, поэтому
опубликованный фронтенд не может разойтись с тем, что проверил CI.

Секреты деплоя: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`,
`DEPLOY_PATH`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_REGISTRY_USERNAME`,
`DEPLOY_REGISTRY_TOKEN`.

---

## Документация

| Файл | О чём |
|---|---|
| [backend/README.md](backend/README.md) | Модель данных, импорт XLSX, workflow, аудит, права, допущения |
| [frontend/README.md](frontend/README.md) | Экраны, сборка, переменные окружения |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Интеграции с LMS и сайтом: что реально, что принято по допущению |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Что осталось сделать, треки работы |
| [docs/TZ-IT-School-RTK.md](docs/TZ-IT-School-RTK.md) | Техническое задание с идентификаторами требований |
| [docs/openapi.json](docs/openapi.json) | Выгрузка схемы API |
