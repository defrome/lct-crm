"""Learners and training applications imported from customer feeds."""

from __future__ import annotations

import datetime as dt
import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import DomainBase


class Learner(DomainBase):
    __tablename__ = "learners"
    __pd_fields__ = frozenset(
        {
            "last_name",
            "first_name",
            "middle_name",
            "phone",
            "email",
            "snils",
            "passport_series",
            "passport_number",
            "passport_issued_by",
            "passport_issue_date",
            "birth_date",
            "registration_region",
            "registration_locality",
            "registration_street",
            "registration_house",
            "registration_apartment",
            "registration_postal_code",
            "education_last_name",
            "education_first_name",
            "education_middle_name",
            "diploma_profession",
            "diploma_institution",
            "diploma_last_name",
            "diploma_number",
            "diploma_series",
            "diploma_registration_number",
            "diploma_issue_date",
        }
    )

    last_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    first_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    middle_name: Mapped[str | None] = mapped_column(sa.Text, default=None)
    phone: Mapped[str | None] = mapped_column(sa.Text, default=None)
    email: Mapped[str | None] = mapped_column(sa.Text, default=None)
    snils: Mapped[str | None] = mapped_column(sa.Text, default=None)
    passport_series: Mapped[str | None] = mapped_column(sa.Text, default=None)
    passport_number: Mapped[str | None] = mapped_column(sa.Text, default=None)
    passport_issued_by: Mapped[str | None] = mapped_column(sa.Text, default=None)
    passport_issue_date: Mapped[dt.date | None] = mapped_column(sa.Date, default=None)
    department_code: Mapped[str | None] = mapped_column(sa.Text, default=None)
    gender: Mapped[str | None] = mapped_column(sa.Text, default=None)
    birth_date: Mapped[dt.date | None] = mapped_column(sa.Date, default=None)
    registration_region: Mapped[str | None] = mapped_column(sa.Text, default=None)
    registration_locality: Mapped[str | None] = mapped_column(sa.Text, default=None)
    registration_street: Mapped[str | None] = mapped_column(sa.Text, default=None)
    registration_house: Mapped[str | None] = mapped_column(sa.Text, default=None)
    registration_apartment: Mapped[str | None] = mapped_column(sa.Text, default=None)
    registration_postal_code: Mapped[str | None] = mapped_column(sa.Text, default=None)
    education_first_name: Mapped[str | None] = mapped_column(sa.Text, default=None)
    education_last_name: Mapped[str | None] = mapped_column(sa.Text, default=None)
    education_middle_name: Mapped[str | None] = mapped_column(sa.Text, default=None)
    education: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_profession: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_institution: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_last_name: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_number: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_series: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_registration_number: Mapped[str | None] = mapped_column(sa.Text, default=None)
    diploma_issue_date: Mapped[dt.date | None] = mapped_column(sa.Date, default=None)

    applications: Mapped[list[TrainingApplication]] = relationship(
        back_populates="learner", lazy="selectin"
    )

    __table_args__ = (
        sa.Index("ix_learners_email", "email"),
        sa.Index("ix_learners_phone", "phone"),
        sa.Index("ix_learners_name", "last_name", "first_name", "middle_name"),
    )


class TrainingApplication(DomainBase):
    __tablename__ = "training_applications"

    order_number: Mapped[str] = mapped_column(sa.Text, nullable=False)
    course: Mapped[str] = mapped_column(sa.Text, nullable=False)
    last_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    first_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    middle_name: Mapped[str | None] = mapped_column(sa.Text, default=None)
    phone: Mapped[str | None] = mapped_column(sa.Text, default=None)
    email: Mapped[str | None] = mapped_column(sa.Text, default=None)
    stream_number: Mapped[int | None] = mapped_column(sa.Integer, default=None)
    learner_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("learners.id", ondelete="RESTRICT"), default=None
    )
    learner: Mapped[Learner | None] = relationship(back_populates="applications", lazy="selectin")

    __table_args__ = (
        sa.Index(
            "uq_training_applications_order_live",
            "order_number",
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        ),
        sa.Index("ix_training_applications_learner_id", "learner_id"),
    )
