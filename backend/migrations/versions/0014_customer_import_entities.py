"""Add learner, training application and vendor contact import entities."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014_customer_import_entities"
down_revision: str | None = "0013_user_telegram_id"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for value in ("vendors", "vendor_contacts", "learners", "applications"):
        op.execute(f"ALTER TYPE import_target ADD VALUE IF NOT EXISTS '{value}'")
    op.create_table(
        "learners",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_name", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("middle_name", sa.Text()),
        sa.Column("phone", sa.Text()),
        sa.Column("email", sa.Text()),
        sa.Column("snils", sa.Text()),
        sa.Column("passport_series", sa.Text()),
        sa.Column("passport_number", sa.Text()),
        sa.Column("passport_issued_by", sa.Text()),
        sa.Column("passport_issue_date", sa.Date()),
        sa.Column("department_code", sa.Text()),
        sa.Column("gender", sa.Text()),
        sa.Column("birth_date", sa.Date()),
        sa.Column("registration_region", sa.Text()),
        sa.Column("registration_locality", sa.Text()),
        sa.Column("registration_street", sa.Text()),
        sa.Column("registration_house", sa.Text()),
        sa.Column("registration_apartment", sa.Text()),
        sa.Column("registration_postal_code", sa.Text()),
        sa.Column("education_first_name", sa.Text()),
        sa.Column("education_last_name", sa.Text()),
        sa.Column("education_middle_name", sa.Text()),
        sa.Column("education", sa.Text()),
        sa.Column("diploma_profession", sa.Text()),
        sa.Column("diploma_institution", sa.Text()),
        sa.Column("diploma_last_name", sa.Text()),
        sa.Column("diploma_number", sa.Text()),
        sa.Column("diploma_series", sa.Text()),
        sa.Column("diploma_registration_number", sa.Text()),
        sa.Column("diploma_issue_date", sa.Date()),
    )
    op.create_index("ix_learners_email", "learners", ["email"])
    op.create_index("ix_learners_phone", "learners", ["phone"])
    op.create_index("ix_learners_name", "learners", ["last_name", "first_name", "middle_name"])

    op.create_table(
        "training_applications",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order_number", sa.Text(), nullable=False),
        sa.Column("course", sa.Text(), nullable=False),
        sa.Column("last_name", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("middle_name", sa.Text()),
        sa.Column("phone", sa.Text()),
        sa.Column("email", sa.Text()),
        sa.Column("stream_number", sa.Integer()),
        sa.Column("learner_id", sa.UUID(), sa.ForeignKey("learners.id", ondelete="RESTRICT")),
    )
    op.create_index(
        "uq_training_applications_order_live",
        "training_applications",
        ["order_number"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index("ix_training_applications_learner_id", "training_applications", ["learner_id"])

    op.create_table(
        "vendor_contacts",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "vendor_id", sa.UUID(), sa.ForeignKey("vendors.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("phone", sa.Text()),
        sa.Column("email", sa.Text()),
        sa.Column("communication_method", sa.Text()),
    )
    op.create_index(
        "uq_vendor_contacts_identity_live",
        "vendor_contacts",
        ["vendor_id", "full_name", "email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_table("vendor_contacts")
    op.drop_table("training_applications")
    op.drop_table("learners")
