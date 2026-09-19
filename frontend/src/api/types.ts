/**
 * Domain types mirroring `docs/openapi.json` (CRM ИТ Школы 0.1.0).
 *
 * Written by hand rather than generated: the generated shapes spell every
 * nullable field as `string | null | undefined` and lose the docs, and this
 * file is read far more often than the spec changes.
 */

export type UUID = string;
/** `YYYY-MM-DD` */
export type DateOnly = string;
/** ISO-8601 with timezone */
export type DateTime = string;

export type UserRole = 'user' | 'manager' | 'admin';
export type UserVisibilityMode = 'assignments' | 'selected' | 'all';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PageQuery {
  page?: number;
  size?: number;
  search?: string;
  /** `field` ascending, `-field` descending, comma-separated */
  sort?: string;
}

/** The single error contract the API uses for every failure (SPEC §10). */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string | null;
}

// --- Сотрудники -------------------------------------------------------------

export interface CurrentUser {
  id: UUID;
  keycloak_id: string;
  full_name: string;
  role: UserRole;
}

export interface UserShort {
  id: UUID;
  full_name: string;
  role: UserRole;
}

export interface UserRead extends UserShort {
  keycloak_id: string;
  email: string | null;
  is_active: boolean;
  visibility_mode: UserVisibilityMode;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface UserCreate {
  keycloak_id: string;
  full_name: string;
  email?: string | null;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserVisibilityUpdate {
  mode: UserVisibilityMode;
  university_ids: UUID[];
}

// --- Вузы -------------------------------------------------------------------

export interface UniversityShort {
  id: UUID;
  name: string;
  short_name?: string | null;
}

export interface UniversityRead extends UniversityShort {
  short_name: string | null;
  region: string | null;
  inn: string | null;
  external_id: string | null;
  comment: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface UniversityCreate {
  name: string;
  short_name?: string | null;
  region?: string | null;
  inn?: string | null;
  external_id?: string | null;
  comment?: string | null;
}

export type UniversityUpdate = Partial<UniversityCreate>;

export interface ContactRead {
  id: UUID;
  university_id: UUID;
  full_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface ContactCreate {
  full_name: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
}

export type ContactUpdate = Partial<ContactCreate>;

export interface AssignmentRead {
  id: UUID;
  university_id: UUID;
  user_id: UUID;
  assigned_from: DateOnly;
  assigned_to: DateOnly | null;
  user?: UserShort | null;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface AssignmentCreate {
  user_id: UUID;
  assigned_from: DateOnly;
  /** `null` — назначение действует бессрочно */
  assigned_to?: DateOnly | null;
}

// --- Справочники ------------------------------------------------------------

export interface VendorRead {
  id: UUID;
  name: string;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface VendorCreate {
  name: string;
}

export interface DirectionRead {
  id: UUID;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface DirectionCreate {
  name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface ProductRead {
  id: UUID;
  name: string;
  vendor_id: UUID | null;
  vendor?: VendorRead | null;
  description: string | null;
  is_active: boolean;
  directions?: DirectionRead[];
  created_at: DateTime;
  updated_at: DateTime;
}

export interface ProductCreate {
  name: string;
  vendor_id?: UUID | null;
  description?: string | null;
  is_active?: boolean;
  direction_ids?: UUID[];
}

// --- Взаимодействия ---------------------------------------------------------

export type CounterpartyGroup = 'b2b' | 'b2c';

export interface InteractionRead {
  id: UUID;
  university_id: UUID;
  counterparty_group: CounterpartyGroup;
  university?: UniversityShort | null;
  it_direction_id: UUID | null;
  it_direction?: DirectionRead | null;
  it_product_id: UUID | null;
  it_product?: ProductRead | null;
  responsible_user_id: UUID | null;
  responsible_user?: UserShort | null;
  contract_number: string | null;
  license_signed_at: DateOnly | null;
  license_years: number | null;
  license_expires_at: DateOnly | null;
  transfer_status: string | null;
  comment: string | null;
  workflow_version_id?: UUID | null;
  current_stage_id?: UUID | null;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface InteractionCreate {
  university_id: UUID;
  counterparty_group?: CounterpartyGroup;
  workflow_id?: UUID | null;
  it_direction_id?: UUID | null;
  it_product_id?: UUID | null;
  responsible_user_id?: UUID | null;
  contract_number?: string | null;
  license_signed_at?: DateOnly | null;
  license_years?: number | null;
  /** Не задано — вычисляется как «дата подписания + срок действия». */
  license_expires_at?: DateOnly | null;
  transfer_status?: string | null;
  comment?: string | null;
}

export type InteractionUpdate = Partial<InteractionCreate>;

export interface InteractionQuery extends PageQuery {
  university_id?: UUID;
  it_direction_id?: UUID;
  it_product_id?: UUID;
  responsible_user_id?: UUID;
}

// --- РљРѕРјРјСѓРЅРёРєР°С†РёРё ---------------------------------------------------------

export type NotificationChannel = 'email' | 'telegram' | 'max';
export type NotificationStatus = 'queued' | 'sent' | 'failed';
export type NotificationRecipient = 'responsible' | 'manager' | 'role' | 'user';

export interface ChatMessageRead {
  id: UUID;
  interaction_id: UUID;
  author_id: UUID;
  author: UserShort;
  body: string;
  created_at: DateTime;
}

export interface ChatMessageCreate {
  body: string;
}

export interface NotificationDeliveryRead {
  id: UUID;
  interaction_id: UUID;
  recipient_user_id: UUID | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  error_message: string | null;
  created_at: DateTime;
  sent_at: DateTime | null;
}

export interface NotificationRuleRead {
  id: UUID;
  workflow_transition_id: UUID | null;
  stale_after_days: number | null;
  recipient_kind: NotificationRecipient;
  recipient_role: UserRole | null;
  recipient_user_id: UUID | null;
  channel: NotificationChannel;
  is_enabled: boolean;
}

export interface NotificationRuleCreate {
  workflow_transition_id?: UUID | null;
  stale_after_days?: number | null;
  recipient_kind: NotificationRecipient;
  recipient_role?: UserRole | null;
  recipient_user_id?: UUID | null;
  channel: NotificationChannel;
}

// --- Workflow ---------------------------------------------------------------

export type WorkflowVersionStatus = 'draft' | 'published' | 'archived';

export interface WorkflowRead {
  id: UUID;
  name: string;
  description: string | null;
  counterparty_group: CounterpartyGroup;
  is_default: boolean;
  is_active: boolean;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface WorkflowCreate {
  name: string;
  description?: string | null;
  counterparty_group?: CounterpartyGroup;
  is_default?: boolean;
}

export type WorkflowUpdate = Partial<WorkflowCreate> & { is_active?: boolean };

export interface VersionRead {
  id: UUID;
  workflow_id: UUID;
  version: number;
  status: WorkflowVersionStatus;
  published_at: DateTime | null;
  comment: string | null;
  created_at: DateTime;
}

export interface VersionCreate {
  /** Скопировать этапы и переходы из этой версии — обычный способ правки. */
  clone_from_id?: UUID | null;
  comment?: string | null;
}

export interface StageRead {
  id: UUID;
  workflow_version_id: UUID;
  code: string | null;
  name: string;
  description: string | null;
  order_index: number;
  is_initial: boolean;
  is_terminal: boolean;
  is_final_success: boolean;
}

export interface StageCreate {
  name: string;
  code?: string | null;
  description?: string | null;
  order_index?: number | null;
  is_initial?: boolean;
  is_terminal?: boolean;
  is_final_success?: boolean;
}

export interface StageRename {
  name: string;
  description?: string | null;
  confirm?: boolean;
}

export interface StageStructureUpdate {
  code?: string | null;
  order_index?: number | null;
  is_initial?: boolean | null;
  is_terminal?: boolean | null;
  is_final_success?: boolean | null;
}

export interface TransitionRead {
  id: UUID;
  workflow_version_id: UUID;
  from_stage_id: UUID;
  to_stage_id: UUID;
  name: string | null;
  requires_comment: boolean;
}

export interface TransitionCreate {
  from_stage_id: UUID;
  to_stage_id: UUID;
  name?: string | null;
  requires_comment?: boolean;
}

export interface StageCardCount {
  stage_id: UUID;
  cards: number;
}

export interface WorkflowGraph {
  workflow: WorkflowRead;
  version: VersionRead;
  stages: StageRead[];
  transitions: TransitionRead[];
  cards_per_stage?: StageCardCount[];
}

export interface StageMigration {
  from_stage_id: UUID;
  to_stage_id: UUID;
}

export interface MigrationPreviewRequest {
  stage_mappings: StageMigration[];
}

export interface MigrationPreviewItem {
  interaction_id: UUID;
  from_stage_id: UUID;
  to_stage_id: UUID | null;
}

export interface MigrationPreview {
  source_version_id: UUID | null;
  target_version_id: UUID;
  affected_cards: MigrationPreviewItem[];
  affected_count: number;
  unmapped_stage_ids: UUID[];
}

export interface PublishRequest extends MigrationPreviewRequest {
  confirm_migration: boolean;
}

export interface StageDeleteRequest {
  target_stage_id: UUID;
  confirm: boolean;
}

export interface StageDeletePreview {
  stage_id: UUID;
  workflow_version_id: UUID;
  affected_count: number;
  interaction_ids: UUID[];
  suggested_target_stage_id: UUID | null;
}

export interface StageHistoryRead {
  id: UUID;
  interaction_id: UUID;
  workflow_version_id: UUID;
  from_stage_id: UUID | null;
  to_stage_id: UUID;
  transition_id: UUID | null;
  comment: string | null;
  created_at: DateTime;
  created_by: UUID | null;
}

export interface RouteView {
  interaction_id: UUID;
  workflow_version_id: UUID | null;
  current_stage_id: UUID | null;
  version?: VersionRead | null;
  stages?: StageRead[];
  transitions?: TransitionRead[];
  /** Переходы, доступные с текущего этапа. */
  available_transitions?: TransitionRead[];
  history?: StageHistoryRead[];
}

export interface RouteStartRequest {
  /** Не задан — берётся workflow по умолчанию. */
  workflow_id?: UUID | null;
  comment?: string | null;
}

export interface TransitionRequest {
  to_stage_id: UUID;
  /** Обязателен, если переход помечен `requires_comment`. */
  comment?: string | null;
}

// --- Вложения ---------------------------------------------------------------

export const ATTACHMENT_FORMATS = [
  'png',
  'jpeg',
  'pdf',
  'zip',
  'gzip',
  'rar',
  'doc',
  'docx',
  'xls',
  'xlsx',
] as const;

export type AttachmentFormat = (typeof ATTACHMENT_FORMATS)[number];

export interface AttachmentRead {
  id: UUID;
  interaction_id: UUID;
  stage_id: UUID;
  filename: string;
  file_format: AttachmentFormat;
  content_type: string;
  size_bytes: number;
  file_hash: string;
  comment: string | null;
  created_at: DateTime;
  created_by: UUID | null;
}

// --- Импорт -----------------------------------------------------------------

export type ImportTarget = 'universities' | 'it_products' | 'interactions' | 'contacts';
export type ImportJobStatus = 'pending' | 'validated' | 'committed' | 'failed' | 'cancelled';
export type ImportRowStatus = 'ok' | 'warning' | 'error';

export interface ImportStats {
  total?: number;
  to_create?: number;
  to_update?: number;
  skipped?: number;
  errors?: number;
  warnings?: number;
  created?: number;
  updated?: number;
}

export interface ImportJobRead {
  id: UUID;
  filename: string;
  file_hash: string;
  target: ImportTarget;
  status: ImportJobStatus;
  mapping: Record<string, string>;
  stats: ImportStats;
  source_headers: string[];
  error_message: string | null;
  created_by: UUID | null;
  created_at: DateTime;
  committed_at: DateTime | null;
}

export interface MappingSuggestion {
  column: string;
  /** `null` — колонка не распознана. */
  field: string | null;
  confidence: number;
}

export interface ImportJobCreated {
  job: ImportJobRead;
  headers: string[];
  suggested_mapping: MappingSuggestion[];
  /** ID предыдущей задачи с тем же файлом — предупреждение, не блокировка. */
  duplicate_of: UUID | null;
  warnings: string[];
}

export interface ImportRowMessage {
  /** The explanation shown to the user; the API spells this `text`. */
  text?: string;
  level?: ImportRowStatus | string;
  /** `table.column` the message is about. */
  field?: string | null;
  /** A value the importer proposes instead — e.g. a fuzzy-matched university. */
  suggestion?: string | null;
  [key: string]: unknown;
}

export interface ImportRowRead {
  id: UUID;
  row_number: number;
  status: ImportRowStatus;
  raw_data: Record<string, unknown>;
  parsed_data: Record<string, unknown>;
  messages: (ImportRowMessage | string)[];
  resolved_entity_id: UUID | null;
}

export interface MappingRequest {
  /** «заголовок колонки файла» → «поле системы» */
  mapping: Record<string, string>;
  save_as_preset?: string | null;
}

export interface ImportCommitResult {
  job: ImportJobRead;
  stats: ImportStats;
}

export interface PresetRead {
  id: UUID;
  name: string;
  target: ImportTarget;
  mapping: Record<string, string>;
  created_by: UUID | null;
  created_at: DateTime;
}

export interface PresetCreate {
  name: string;
  target?: ImportTarget;
  mapping: Record<string, string>;
}

// --- Аудит ------------------------------------------------------------------

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'read_pd'
  | 'import'
  | 'export'
  | 'login'
  | 'access_denied';

export interface AuditLogRead {
  id: number;
  occurred_at: DateTime;
  actor_id: UUID | null;
  actor_name: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: UUID | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: UUID | null;
}

export interface AuditQuery {
  actor_id?: UUID;
  entity_type?: string;
  entity_id?: UUID;
  action?: AuditAction;
  date_from?: DateOnly;
  date_to?: DateOnly;
  page?: number;
  size?: number;
}
