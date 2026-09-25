"""Enumerations backed by native PostgreSQL enum types (SPEC §4.1)."""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    USER = "user"
    MANAGER = "manager"
    ADMIN = "admin"


class UserVisibilityMode(StrEnum):
    """How a KAM's row-level university visibility is calculated (UC-A-01)."""

    ASSIGNMENTS = "assignments"
    SELECTED = "selected"
    ALL = "all"


class ImportTarget(StrEnum):
    UNIVERSITIES = "universities"
    IT_PRODUCTS = "it_products"
    INTERACTIONS = "interactions"
    CONTACTS = "contacts"
    VENDORS = "vendors"
    VENDOR_CONTACTS = "vendor_contacts"
    LEARNERS = "learners"
    APPLICATIONS = "applications"


class ImportJobStatus(StrEnum):
    PENDING = "pending"
    VALIDATED = "validated"
    COMMITTED = "committed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ImportRowStatus(StrEnum):
    OK = "ok"
    WARNING = "warning"
    ERROR = "error"


class WorkflowVersionStatus(StrEnum):
    """Lifecycle of one workflow version.

    Structural edits are only legal on a `draft`; publishing freezes the
    version so cards already running on it keep the route they started with.
    """

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class CounterpartyGroup(StrEnum):
    """Business segment a card and its workflow belong to (H-WF-02)."""

    B2B = "b2b"
    B2C = "b2c"


class AttachmentFormat(StrEnum):
    """The ten formats the customer requires for stage attachments (FR-04)."""

    PNG = "png"
    JPEG = "jpeg"
    PDF = "pdf"
    ZIP = "zip"
    GZIP = "gzip"
    RAR = "rar"
    DOC = "doc"
    DOCX = "docx"
    XLS = "xls"
    XLSX = "xlsx"


class IntegrationSource(StrEnum):
    """External systems the CRM pulls data from (FR-06, UC-U-02)."""

    LMS = "lms"
    WEBSITE = "website"


class IntegrationMode(StrEnum):
    """Where a source's payload actually comes from.

    `fixture` replays a JSON file shipped with the repository, so the whole
    ingest path is demonstrable before the customer hands over the API
    contract; `http` calls the real endpoint.
    """

    FIXTURE = "fixture"
    HTTP = "http"


class IntegrationSyncStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class AuditAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    READ_PD = "read_pd"
    IMPORT = "import"
    EXPORT = "export"
    LOGIN = "login"
    ACCESS_DENIED = "access_denied"


# Names of the PostgreSQL enum types. Kept in one place so models and Alembic
# migrations cannot drift apart.
USER_ROLE_ENUM = "user_role"
USER_VISIBILITY_MODE_ENUM = "user_visibility_mode"
IMPORT_TARGET_ENUM = "import_target"
IMPORT_JOB_STATUS_ENUM = "import_job_status"
IMPORT_ROW_STATUS_ENUM = "import_row_status"
AUDIT_ACTION_ENUM = "audit_action"
WORKFLOW_VERSION_STATUS_ENUM = "workflow_version_status"
COUNTERPARTY_GROUP_ENUM = "counterparty_group"
INTEGRATION_SOURCE_ENUM = "integration_source"
INTEGRATION_MODE_ENUM = "integration_mode"
INTEGRATION_SYNC_STATUS_ENUM = "integration_sync_status"
ATTACHMENT_FORMAT_ENUM = "attachment_format"
