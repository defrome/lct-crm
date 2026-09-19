"""SMTP transport selection and safety checks."""

from __future__ import annotations

import ssl
from typing import ClassVar

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.config import Settings
from app.services import communications


class FakeSMTP:
    instances: ClassVar[list[FakeSMTP]] = []

    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.host, self.port, self.timeout = host, port, timeout
        self.started_tls = False
        self.login_args: tuple[str, str] | None = None
        self.sent: object | None = None
        type(self).instances.append(self)

    def __enter__(self) -> FakeSMTP:
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def starttls(self, *, context: ssl.SSLContext) -> None:
        assert isinstance(context, ssl.SSLContext)
        self.started_tls = True

    def login(self, username: str, password: str) -> None:
        self.login_args = (username, password)

    def send_message(self, message: object) -> None:
        self.sent = message


def test_send_email_uses_starttls_and_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeSMTP.instances.clear()
    monkeypatch.setattr(communications.smtplib, "SMTP", FakeSMTP)

    communications._send_email(
        "smtp.example.test",
        587,
        "crm",
        "secret",
        "crm@example.test",
        "user@example.test",
        "Test message",
        True,
        False,
    )

    instance = FakeSMTP.instances[0]
    assert instance.host == "smtp.example.test"
    assert instance.started_tls is True
    assert instance.login_args == ("crm", "secret")
    assert instance.sent is not None


def test_send_email_uses_implicit_tls(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeSMTPSSL(FakeSMTP):
        instances: ClassVar[list[FakeSMTPSSL]] = []

    FakeSMTP.instances.clear()
    FakeSMTPSSL.instances.clear()
    monkeypatch.setattr(communications.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(communications.smtplib, "SMTP_SSL", FakeSMTPSSL)

    communications._send_email(
        "smtp.example.test",
        465,
        None,
        None,
        "crm@example.test",
        "user@example.test",
        "Test message",
        False,
        True,
    )

    assert not FakeSMTP.instances
    assert len(FakeSMTPSSL.instances) == 1
    assert FakeSMTPSSL.instances[0].started_tls is False


def test_settings_rejects_both_smtp_encryption_modes() -> None:
    with pytest.raises(PydanticValidationError, match="cannot both be enabled"):
        Settings(smtp_use_tls=True, smtp_use_ssl=True)
