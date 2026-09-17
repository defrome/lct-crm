"""Provisional contracts for the LMS and website feeds.

**Read this first.** The customer has not handed over the API contract
(`OPEN-01`) or the list of agreed JSON fields (`OPEN-04`). Everything in this
module is therefore an *assumption*, written down explicitly so that swapping in
the real thing is a change to data, not to code.

Everything else in `app/integrations` is real, working code: it reads a payload,
normalises it and writes through the ordinary service layer. Only the two
mapping tables below encode what the external systems are assumed to send. When
the contract arrives, edit `LMS_CONTRACT` and `WEBSITE_CONTRACT` — and nothing
else — then delete the fixtures.

The two feeds deliberately use different field names and envelopes: the LMS
speaks nested English, the Laravel site flat transliterated Russian. If the
mapping layer can absorb that difference, it can absorb the real one.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models.enums import IntegrationSource


def read_path(payload: Any, path: str | None) -> Any:
    """Read a dotted path out of a decoded JSON document.

    `university.name` and `0.title` both work; a missing link anywhere on the
    way yields ``None`` rather than raising, because a feed that omits an
    optional field is normal, not exceptional.
    """
    if not path:
        return None
    current = payload
    for part in path.split("."):
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return current


@dataclass(frozen=True, slots=True)
class SourceContract:
    """How one external system's JSON maps onto the CRM's own vocabulary."""

    source: IntegrationSource
    title: str
    # Where the array of records sits in the response body. Empty string means
    # the body *is* the array.
    items_path: str
    # Where the "fetch the next page" token sits, if the feed pages at all.
    cursor_path: str | None
    # internal field name -> dotted path in one record
    fields: dict[str, str]
    # Contacts arrive as a nested array; these describe it.
    contacts_path: str | None = None
    contact_fields: dict[str, str] = field(default_factory=dict)
    # Query-string parameter used to ask for the next page.
    cursor_param: str = "cursor"

    def records(self, payload: Any) -> list[dict[str, Any]]:
        items = read_path(payload, self.items_path) if self.items_path else payload
        if items is None:
            return []
        if isinstance(items, dict):  # a single record returned bare
            return [items]
        return [item for item in items if isinstance(item, dict)]

    def next_cursor(self, payload: Any) -> str | None:
        value = read_path(payload, self.cursor_path)
        return str(value) if value else None


# --- LMS -------------------------------------------------------------------
# ASSUMED. Nested envelope, English field names, cursor pagination.
#
#   {"items": [{"id": "...", "university": {"name": "..."}, ...}],
#    "next_cursor": null}

LMS_CONTRACT = SourceContract(
    source=IntegrationSource.LMS,
    title="LMS ИТ Школы",
    items_path="items",
    cursor_path="next_cursor",
    cursor_param="cursor",
    fields={
        "external_id": "id",
        "university_name": "university.name",
        "university_external_id": "university.id",
        "region": "university.region",
        "inn": "university.inn",
        "direction_name": "direction",
        "vendor_name": "product.vendor",
        "product_name": "product.name",
        "manager_full_name": "manager",
        "contract_number": "contract_number",
        "license_signed_at": "license_signed_at",
        "license_years": "license_years",
        "transfer_status": "status",
        "comment": "comment",
    },
    contacts_path="contacts",
    contact_fields={
        "full_name": "full_name",
        "position": "position",
        "email": "email",
        "phone": "phone",
    },
)


# --- Website (CMS Laravel) -------------------------------------------------
# ASSUMED. Laravel's default resource envelope (`data`), flat transliterated
# field names, page-number pagination.
#
#   {"data": [{"uuid": "...", "vuz_nazvanie": "...", ...}],
#    "links": {"next": "..."}}

WEBSITE_CONTRACT = SourceContract(
    source=IntegrationSource.WEBSITE,
    title="Сайт ИТ Школы (CMS Laravel)",
    items_path="data",
    cursor_path="links.next",
    cursor_param="page",
    fields={
        "external_id": "uuid",
        "university_name": "vuz_nazvanie",
        "region": "region",
        "inn": "inn",
        "direction_name": "napravlenie",
        "vendor_name": "vendor",
        "product_name": "po",
        "manager_full_name": "otvetstvennyj_shkola",
        "contract_number": "nomer_dogovora",
        "license_signed_at": "data_podpisaniya",
        "license_years": "srok_licenzii",
        "transfer_status": "status_peredachi",
        "comment": "kommentarij",
    },
    contacts_path="otvetstvennye_vuza",
    contact_fields={
        "full_name": "fio",
        "position": "dolzhnost",
        "email": "email",
        "phone": "telefon",
    },
)


CONTRACTS: dict[IntegrationSource, SourceContract] = {
    IntegrationSource.LMS: LMS_CONTRACT,
    IntegrationSource.WEBSITE: WEBSITE_CONTRACT,
}


def contract_for(source: IntegrationSource) -> SourceContract:
    return CONTRACTS[source]
