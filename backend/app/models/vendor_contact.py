"""Contacts belonging to software vendors."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import DomainBase
from app.models.product import Vendor


class VendorContact(DomainBase):
    __tablename__ = "vendor_contacts"

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    phone: Mapped[str | None] = mapped_column(sa.Text, default=None)
    email: Mapped[str | None] = mapped_column(sa.Text, default=None)
    communication_method: Mapped[str | None] = mapped_column(sa.Text, default=None)
    vendor: Mapped[Vendor] = relationship(lazy="selectin")

    __table_args__ = (
        sa.Index(
            "uq_vendor_contacts_identity_live",
            "vendor_id",
            "full_name",
            "email",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
    )
