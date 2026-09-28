# Разработка и развёртывание в Linux

Документ описывает только запуск на Linux-сервере. Проект разворачивается в Docker Compose: API (FastAPI), web-интерфейс (React/Nginx), PostgreSQL, Keycloak, MinIO, Redis, Mailpit и мониторинг. Исходный код загружается из [github.com/defrome/lct-crm](https://github.com/defrome/lct-crm).

## Требования

- Ubuntu 22.04/24.04, Debian 12 или совместимый Linux с `systemd`;
- DNS-записи `DOMAIN`, `KEYCLOAK_DOMAIN` и `GRAFANA_DOMAIN`, указывающие на сервер;
- открытые TCP-порты 80 и 443;
- пользователь с `sudo` и доступом в интернет.

Скрипт ниже устанавливает Docker Engine и Compose plugin из официального репозитория Docker. Если Docker уже установлен, шаг установки пропускается.

## Автоматическая установка и запуск

Выполните на чистом сервере одной командой. Она клонирует репозиторий в `/opt/lct-crm`, создаёт конфигурацию, запрашивает обязательные секреты, проверяет Compose-файл и запускает все сервисы.

```bash
sudo bash -s <<'INSTALL'
set -Eeuo pipefail
APP_DIR=/opt/lct-crm
REPO=https://github.com/defrome/lct-crm.git

if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl git openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo $ID)/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$(. /etc/os-release && echo $ID) $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  apt-get update
  apt-get install -y ca-certificates curl git openssl
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
fi

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth=1 origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth=1 "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
if [ ! -f .env ]; then
  install -m 600 .env.server.example .env
fi
read -r -p 'Публичный домен приложения (например, crm.example.com): ' DOMAIN
read -r -p 'Домен Keycloak (например, auth.crm.example.com): ' KEYCLOAK_DOMAIN
read -r -p 'Домен Grafana (например, grafana.crm.example.com): ' GRAFANA_DOMAIN
read -r -s -p 'Пароль PostgreSQL: ' POSTGRES_PASSWORD; echo
read -r -s -p 'Пароль MinIO: ' MINIO_ROOT_PASSWORD; echo
read -r -s -p 'Пароль администратора Keycloak: ' KEYCLOAK_ADMIN_PASSWORD; echo
read -r -s -p 'Пароль администратора Grafana: ' GRAFANA_ADMIN_PASSWORD; echo
AUDIT_HASH_KEY=$(openssl rand -hex 32)

set_env() {
  local key=$1 value=$2 escaped
  escaped=$(printf '%s' "$value" | sed 's/[\\&|]/\\&/g')
  sed -i "s|^${key}=.*|${key}=${escaped}|" .env
}
set_env DOMAIN "$DOMAIN"
set_env KEYCLOAK_DOMAIN "$KEYCLOAK_DOMAIN"
set_env GRAFANA_DOMAIN "$GRAFANA_DOMAIN"
set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
set_env MINIO_ROOT_PASSWORD "$MINIO_ROOT_PASSWORD"
set_env KEYCLOAK_ADMIN_PASSWORD "$KEYCLOAK_ADMIN_PASSWORD"
set_env GRAFANA_ADMIN_PASSWORD "$GRAFANA_ADMIN_PASSWORD"
set_env AUDIT_HASH_KEY "$AUDIT_HASH_KEY"
chmod 600 .env
docker compose --env-file .env -f docker-compose.deploy.yml config -q
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
docker compose --env-file .env -f docker-compose.deploy.yml ps
echo "Готово. Приложение доступно по адресу https://$DOMAIN"
INSTALL
```

Для Debian/Ubuntu команда должна выполняться от `root` или пользователем, имеющим `sudo`. Пароли не сохраняются в истории shell: они вводятся через `read -s`. Перед запуском убедитесь, что DNS уже обновился; Caddy автоматически выпустит TLS-сертификаты Let's Encrypt.

Если требуется заранее подготовить конфигурацию без запуска, выполните:

```bash
cd /opt/lct-crm
cp .env.server.example .env
chmod 600 .env
nano .env
docker compose --env-file .env -f docker-compose.deploy.yml config -q
```

Обязательные значения: `DOMAIN`, `KEYCLOAK_DOMAIN`, `GRAFANA_DOMAIN`, `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `GRAFANA_ADMIN_PASSWORD` и уникальный `AUDIT_HASH_KEY`. Никогда не добавляйте `.env` в Git.

## Управление стеком

Все команды выполняются из `/opt/lct-crm` и используют серверный файл `.env`:

```bash
cd /opt/lct-crm
docker compose --env-file .env -f docker-compose.deploy.yml ps
docker compose --env-file .env -f docker-compose.deploy.yml logs -f api web caddy
docker compose --env-file .env -f docker-compose.deploy.yml pull
docker compose --env-file .env -f docker-compose.deploy.yml up -d --build
docker compose --env-file .env -f docker-compose.deploy.yml down
```

Не используйте `docker compose down --volumes` на сервере: volumes содержат базу данных, файлы MinIO, Keycloak, TLS-сертификаты Caddy и историю мониторинга. Откат выполняется возвратом репозитория к нужному коммиту и повторным `up -d --build`.

## Разработка и проверки

```bash
git clone https://github.com/defrome/lct-crm.git
cd lct-crm
cp .env.example .env
docker compose -f docker-compose.yml config -q
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl --fail http://localhost:8000/health
```

Локальные адреса: web — `http://localhost:5173`, API/Swagger — `http://localhost:8000/docs`, Keycloak — `http://localhost:8080`, Grafana — `http://localhost:3000`, Mailpit — `http://localhost:8025`.

Проверки без Docker:

```bash
cd backend
python3 -m pip install -e '.[dev]'
pytest
ruff check .
ruff format --check .
mypy app
cd ../frontend
npm ci
npm run lint
npm run build
```

Миграции базы данных выполняются API при старте. Резервное копирование PostgreSQL, MinIO и Keycloak, сетевые ограничения и production-настройки секретов должны быть настроены до ввода сервера в эксплуатацию.
