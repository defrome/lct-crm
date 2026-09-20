# SMTP and Email Notifications

The application sends email through SMTP from its notification outbox. Delivery
does not block interaction changes: delivery errors remain in the outbox and
are retried during the next worker run.

## Local Development

`docker compose up --build` starts Mailpit. It accepts mail only from the
Compose network, never relays it to the outside world, and displays captured
mail at http://localhost:8025.

For this scenario, leave these values in `.env` empty or set them explicitly:

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=crm@example.test
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

When running the API directly on the host rather than in Compose, set
`SMTP_HOST=127.0.0.1`. Mailpit does not need credentials by default, so
`SMTP_USERNAME` and `SMTP_PASSWORD` can remain empty.

Enable both notification flags before testing delivery:

```dotenv
FEATURE_NOTIFICATIONS_ENABLED=true
FEATURE_EXTERNAL_CHANNELS_ENABLED=true
```

Restart the API, create an email notification rule, and ensure the recipient
has a working email address. The worker processes the queue every
`NOTIFICATIONS_POLL_SECONDS` seconds (minimum 10). A manager can also trigger
immediate processing with `POST /api/v1/notifications/deliver`.

## Server deployment

`docker-compose.deploy.yml` includes Mailpit as an internal, non-relaying sink.
Its SMTP port is available only on the Compose network (`mailpit:1025`); only
the web UI is bound to `127.0.0.1:8025`. This is a safe default for checking
the notification pipeline, but Mailpit does not deliver messages to real
recipients.

Copy `.env.server.example` to `/opt/lct-crm/.env` for this mode and keep:

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=crm@example.test
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

To deliver real mail, replace those values with the SMTP relay supplied by
your mail provider and redeploy the API. Do not set `SMTP_HOST` to
`localhost` or `127.0.0.1`: the API runs inside Docker, so those addresses
refer to the API container itself.

For a typical SMTP submission relay using STARTTLS on port 587:

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

For implicit TLS, usually port 465, use `SMTP_USE_TLS=false` and
`SMTP_USE_SSL=true`. For a trusted internal relay without encryption, set both
values to `false`. `SMTP_USE_TLS` and `SMTP_USE_SSL` cannot both be enabled;
the API rejects that invalid configuration at startup.

Do not expose the SMTP port or the Mailpit web interface. Keep `SMTP_PASSWORD`
only in the server `.env` or a secrets manager, never in Git.
