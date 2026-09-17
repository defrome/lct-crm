"""Where an integration's payload comes from.

Two interchangeable implementations behind one protocol:

* `FixtureSource` replays a JSON file shipped with the repository. It exists so
  the whole ingest path — normalisation, matching, upsert, workflow placement,
  audit — is demonstrable and testable before the customer hands over the API
  contract.
* `HttpJsonSource` calls the real endpoint. It is complete, not a placeholder:
  auth header, paging, timeouts and error mapping are all implemented. What is
  *assumed* is the shape of the JSON, and that lives in `contract.py`.

Which one runs is decided by configuration, never by code: a source with no URL
configured falls back to its fixture, so a developer checkout works out of the
box and a configured deployment talks to the real system.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Protocol

import httpx

from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.integrations.contract import SourceContract, contract_for
from app.models.enums import IntegrationMode, IntegrationSource

logger = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class IntegrationUnavailableError(AppError):
    """The external system could not be reached or answered with an error."""

    code = ErrorCode.INTERNAL_ERROR
    http_status = 502
    message = "Внешняя система недоступна"


class ExternalSource(Protocol):
    """Yields raw records already extracted from the response envelope."""

    mode: IntegrationMode
    contract: SourceContract

    async def fetch(self) -> list[dict[str, Any]]: ...


class FixtureSource:
    """Replays a JSON file from `app/integrations/fixtures`."""

    mode = IntegrationMode.FIXTURE

    def __init__(self, source: IntegrationSource, path: Path | None = None) -> None:
        self.contract = contract_for(source)
        self.path = path or FIXTURES_DIR / f"{source.value}.json"

    async def fetch(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            raise IntegrationUnavailableError(
                "Файл с демонстрационными данными не найден",
                details={"path": str(self.path)},
            )
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        records = self.contract.records(payload)
        logger.info("fixture %s: %d records", self.path.name, len(records))
        return records


class HttpJsonSource:
    """Calls the external JSON API described by the source's contract."""

    mode = IntegrationMode.HTTP

    def __init__(
        self,
        source: IntegrationSource,
        *,
        base_url: str,
        token: str | None = None,
        timeout: float | None = None,
        page_limit: int | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.contract = contract_for(source)
        self.base_url = base_url
        self.token = token
        self.timeout = timeout or settings.integrations_timeout
        self.page_limit = page_limit or settings.integrations_page_limit
        # httpx's own injection point. Left open so retries, proxies or a
        # recorded transport can be supplied without touching this class.
        self.transport = transport

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def fetch(self) -> list[dict[str, Any]]:
        """Walk every page the feed offers, up to a hard cap.

        The cap is deliberate: an integration that follows cursors forever is
        one misbehaving upstream away from an unbounded loop.
        """
        collected: list[dict[str, Any]] = []
        cursor: str | None = None
        pages = 0

        async with httpx.AsyncClient(
            timeout=self.timeout, headers=self._headers(), transport=self.transport
        ) as client:
            while True:
                params = {self.contract.cursor_param: cursor} if cursor else None
                try:
                    response = await client.get(self.base_url, params=params)
                    response.raise_for_status()
                    payload = response.json()
                except httpx.HTTPStatusError as exc:
                    raise IntegrationUnavailableError(
                        f"Внешняя система ответила кодом {exc.response.status_code}",
                        details={"url": self.base_url, "status": exc.response.status_code},
                    ) from None
                except httpx.HTTPError as exc:
                    raise IntegrationUnavailableError(
                        "Не удалось получить данные из внешней системы",
                        details={"url": self.base_url, "reason": str(exc)},
                    ) from None
                except json.JSONDecodeError:
                    raise IntegrationUnavailableError(
                        "Внешняя система вернула не JSON",
                        details={"url": self.base_url},
                    ) from None

                collected.extend(self.contract.records(payload))
                pages += 1
                cursor = self.contract.next_cursor(payload)
                if not cursor or pages >= self.page_limit:
                    break

        logger.info("%s: fetched %d records over %d page(s)", self.base_url, len(collected), pages)
        return collected


def source_settings(source: IntegrationSource) -> tuple[str | None, str | None]:
    """URL and token configured for a source, if any."""
    if source is IntegrationSource.LMS:
        return settings.lms_api_url, settings.lms_api_token
    return settings.website_api_url, settings.website_api_token


def build_source(source: IntegrationSource) -> ExternalSource:
    """Pick the real API when it is configured, the fixture otherwise."""
    url, token = source_settings(source)
    if settings.integrations_mode is IntegrationMode.HTTP and url:
        return HttpJsonSource(source, base_url=url, token=token)
    return FixtureSource(source)
