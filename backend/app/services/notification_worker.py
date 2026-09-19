"""Small in-process worker for the notification outbox."""

from __future__ import annotations

import asyncio
import logging

import asyncpg
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.db import SessionFactory, database_is_available
from app.services.communications import CommunicationService

logger = logging.getLogger(__name__)


async def notification_loop() -> None:
    """Queue stalled-card reminders and retry delivery without touching workflow writes."""
    while True:
        try:
            # The worker is best-effort. During a database/Docker DNS restart
            # the API should stay alive and retry on the next poll instead of
            # emitting a full traceback every iteration.
            if not await database_is_available(log_failure=False):
                await asyncio.sleep(settings.notifications_poll_seconds)
                continue
            async with SessionFactory() as session:
                service = CommunicationService(session)
                await service.check_stalled()
                await service.deliver_pending()
        except (OSError, asyncpg.PostgresError, SQLAlchemyError) as exc:
            # Database outages are expected during restarts and DNS recovery;
            # keep the worker alive without flooding logs with a traceback.
            logger.warning("notification worker skipped: database unavailable: %s", exc)
        except Exception:
            logger.exception("notification worker iteration failed")
        await asyncio.sleep(settings.notifications_poll_seconds)
