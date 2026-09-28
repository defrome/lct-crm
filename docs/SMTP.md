# SMTP и уведомления по электронной почте

Приложение отправляет электронные письма через SMTP из очереди уведомлений.
Доставка не блокирует изменения во взаимодействиях: при ошибке запись остаётся
в статусе `failed` и повторно обрабатывается worker или менеджером из центра
уведомлений.

## Локальная разработка

Команда `docker compose up --build` запускает Mailpit. Он принимает письма
только из сети Compose, никогда не пересылает их во внешний мир и показывает
перехваченные письма по адресу http://localhost:8025.

Для этого сценария оставьте следующие значения в `.env` пустыми или задайте их
явно:

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=crm@example.test
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

Если API запускается непосредственно на хосте, а не в Compose, задайте
`SMTP_HOST=127.0.0.1`. По умолчанию Mailpit не требует учётных данных, поэтому
`SMTP_USERNAME` и `SMTP_PASSWORD` можно оставить пустыми.

Для создания напоминаний включите worker; для реальной отправки дополнительно
разрешите внешние каналы:

```dotenv
FEATURE_NOTIFICATIONS_ENABLED=true
FEATURE_EXTERNAL_CHANNELS_ENABLED=true
```

Перезапустите API, создайте правило уведомлений по электронной почте и
убедитесь, что у получателя указан действующий адрес. Обработчик проверяет
очередь каждые `NOTIFICATIONS_POLL_SECONDS` секунд (минимум 10 секунд).
Менеджер также может запустить немедленную обработку кнопкой в центре
уведомлений или запросом `POST /api/v1/notifications/deliver`.

## Развёртывание на сервере

`docker-compose.deploy.yml` включает Mailpit как внутренний SMTP-приёмник без
пересылки писем. SMTP-порт доступен только в сети Compose (`mailpit:1025`), а
веб-интерфейс привязан только к `127.0.0.1:8025`. Это безопасный вариант для
проверки конвейера уведомлений, но Mailpit не доставляет письма реальным
получателям.

Скопируйте `.env.server.example` в `/opt/lct-crm/.env` для этого режима и
оставьте следующие параметры:

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=crm@example.test
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

Чтобы отправлять настоящие письма, замените эти значения на параметры SMTP-
ретранслятора вашего почтового провайдера и перезапустите API. Не
указывайте `SMTP_HOST=localhost` или `127.0.0.1`: API работает внутри Docker,
поэтому эти адреса указывают на сам контейнер API.

Для обычного SMTP-ретранслятора с STARTTLS на порту 587:

```dotenv
FEATURE_NOTIFICATIONS_ENABLED=true
FEATURE_EXTERNAL_CHANNELS_ENABLED=true
SMTP_HOST=smtp.company.example
SMTP_PORT=587
SMTP_USERNAME=crm-notifications@company.example
SMTP_PASSWORD=replace-with-secret
SMTP_FROM=crm-notifications@company.example
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

Для неявного TLS, обычно на порту 465, используйте
`SMTP_USE_TLS=false` и `SMTP_USE_SSL=true`. Для доверенного внутреннего
ретранслятора без шифрования установите оба значения в `false`.
`SMTP_USE_TLS` и `SMTP_USE_SSL` нельзя включать одновременно: API отклонит
такую некорректную конфигурацию при запуске.

Не открывайте SMTP-порт или веб-интерфейс Mailpit во внешний доступ.
Храните `SMTP_PASSWORD` только в серверном `.env` или менеджере секретов,
никогда не добавляйте его в Git.

## Telegram

Очередь уведомлений также поддерживает Telegram при наличии `TELEGRAM_BOT_TOKEN`
и Telegram ID получателя. Допустимые каналы уведомлений — `email` и `telegram`.
