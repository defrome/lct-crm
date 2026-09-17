"""Turning one external record into the CRM's own vocabulary.

Normalisation rules are deliberately the same ones the Excel import uses — the
dates, the licence term, the whitespace folding. A field that arrives over an
API and the same field typed into a spreadsheet must end up identical in the
database, otherwise the two channels quietly create near-duplicate rows.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any

from app.imports.validators import (
    RowMessage,
    error,
    parse_date,
    parse_email,
    parse_license_years,
    parse_text,
)
from app.integrations.contract import SourceContract, read_path
from app.services.text import clean_text


@dataclass(slots=True)
class ExternalContact:
    full_name: str
    position: str | None = None
    email: str | None = None
    phone: str | None = None


@dataclass(slots=True)
class NormalizedRecord:
    """One external record, expressed in the CRM's own field names."""

    external_id: str | None = None
    university_name: str | None = None
    university_external_id: str | None = None
    region: str | None = None
    inn: str | None = None
    direction_name: str | None = None
    vendor_name: str | None = None
    product_name: str | None = None
    manager_full_name: str | None = None
    contract_number: str | None = None
    license_signed_at: dt.date | None = None
    license_years: int | None = None
    transfer_status: str | None = None
    comment: str | None = None
    contacts: list[ExternalContact] = field(default_factory=list)

    def label(self) -> str:
        """How this record is named back to the user in messages."""
        return self.external_id or self.university_name or "запись без идентификатора"


def _append(messages: list[RowMessage], message: RowMessage | None) -> None:
    if message is not None:
        messages.append(message)


def normalize(
    contract: SourceContract, raw: dict[str, Any]
) -> tuple[NormalizedRecord, list[RowMessage]]:
    """Map and validate a raw record. Never raises: a bad field is a message."""
    messages: list[RowMessage] = []
    record = NormalizedRecord()

    def value_of(name: str) -> Any:
        return read_path(raw, contract.fields.get(name))

    record.external_id = clean_text(value_of("external_id"))

    university_name, message = parse_text(
        value_of("university_name"), "university_name", max_length=500
    )
    _append(messages, message)
    record.university_name = university_name
    if not university_name:
        # Same rule as the spreadsheet import: without a university there is
        # nothing to attach the record to.
        messages.append(error("Не заполнено название вуза", "university_name"))

    record.university_external_id = clean_text(value_of("university_external_id"))

    for name, max_length in (("region", 200), ("inn", 20)):
        parsed, message = parse_text(value_of(name), name, max_length=max_length)
        _append(messages, message)
        setattr(record, name, parsed)

    for name, max_length in (
        ("direction_name", 300),
        ("vendor_name", 300),
        ("product_name", 300),
        ("manager_full_name", 300),
        ("contract_number", 200),
        ("transfer_status", 300),
    ):
        parsed, message = parse_text(value_of(name), name, max_length=max_length)
        _append(messages, message)
        setattr(record, name, parsed)

    comment, message = parse_text(value_of("comment"), "comment")
    _append(messages, message)
    record.comment = comment

    signed_at, message = parse_date(value_of("license_signed_at"), "license_signed_at")
    _append(messages, message)
    record.license_signed_at = signed_at

    years, message = parse_license_years(value_of("license_years"), "license_years")
    _append(messages, message)
    record.license_years = years

    record.contacts = _normalize_contacts(contract, raw, messages)
    return record, messages


def _normalize_contacts(
    contract: SourceContract, raw: dict[str, Any], messages: list[RowMessage]
) -> list[ExternalContact]:
    if not contract.contacts_path:
        return []
    items = read_path(raw, contract.contacts_path)
    if not isinstance(items, list):
        return []

    contacts: list[ExternalContact] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        full_name, message = parse_text(
            read_path(item, contract.contact_fields.get("full_name")),
            "contact.full_name",
            max_length=300,
        )
        _append(messages, message)
        if not full_name:
            continue

        position, message = parse_text(
            read_path(item, contract.contact_fields.get("position")),
            "contact.position",
            max_length=300,
        )
        _append(messages, message)
        email, message = parse_email(
            read_path(item, contract.contact_fields.get("email")), "contact.email"
        )
        _append(messages, message)
        phone, message = parse_text(
            read_path(item, contract.contact_fields.get("phone")),
            "contact.phone",
            max_length=50,
        )
        _append(messages, message)

        contacts.append(
            ExternalContact(full_name=full_name, position=position, email=email, phone=phone)
        )
    return contacts
