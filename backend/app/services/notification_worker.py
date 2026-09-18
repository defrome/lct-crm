"""Small in-process worker for the notification outbox."""

from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.core.db import SessionFactory
from app.services.communications import CommunicationService

logger = logging.getLogger(__name__)


async def notification_loop() -> None:
    """Queue stalled-card reminders and retry delivery without touching workflow writes."""
    while True:
        try:
            async with SessionFactory() as session:
                service = CommunicationService(session)
                await service.check_stalled()
                await service.deliver_pending()
        except Exception:
            logger.exception("notification worker iteration failed")
        await asyncio.sleep(settings.notifications_poll_seconds)
