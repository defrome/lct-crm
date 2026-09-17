"""Integrations with the LMS and the website (SPEC-04 scaffold).

The ingest pipeline is real; only the shape of the incoming JSON is assumed.
See `contract.py` and `docs/INTEGRATIONS.md`.
"""

from app.integrations.ingest import IntegrationService, describe_sources

__all__ = ["IntegrationService", "describe_sources"]
