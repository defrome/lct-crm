"""Create the built-in workflow on every application database startup.

This is deliberately separate from ``scripts.seed``: production deployments
do not load demo data, but they must still have the workflow used by new cards.
The operation is idempotent and safe to run on every container restart.
"""

from __future__ import annotations

import asyncio
import logging

from app.core.access import AccessScope
from app.core.db import SessionFactory, dispose_engine
from app.core.logging import configure_logging
from app.services.workflow_presets import ensure_base_workflow

logger = logging.getLogger("ensure-base-workflow")


async def ensure() -> None:
    async with SessionFactory() as session:
        workflow = await ensure_base_workflow(session, AccessScope.system())
        logger.info("base workflow ready: %s", workflow.name)
    await dispose_engine()


def main() -> None:
    configure_logging()
    asyncio.run(ensure())


if __name__ == "__main__":
    main()
