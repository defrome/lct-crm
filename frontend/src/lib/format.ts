import type { AuditAction, ImportTarget, UserRole } from '@/api/types';

const DATE = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATE_LONG = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const NUMBER = new Intl.NumberFormat('ru-RU');

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE.format(date);
}

export function formatDateLong(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_LONG.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${DATE.format(date)}, ${TIME.format(date)}`;
}

/** «сегодня», «вчера», «3 дня назад» — for activity feeds where the exact minute is noise. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return `сегодня, ${TIME.format(date)}`;
  if (days === 1) return `вчера, ${TIME.format(date)}`;
  if (days < 7) return `${days} дн. назад`;
  return DATE.format(date);
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : NUMBER.format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/** `YYYY-MM-DD` for the API and for `<input type="date">`. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  return toDateInput(new Date());
}

/** Иванов Иван Иванович → ИИ */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Иванов Иван Иванович → Иванов И. И. — fits a table column without losing the person. */
export function shortName(fullName: string | null | undefined): string {
  if (!fullName) return '—';
  const [last, first, middle] = fullName.trim().split(/\s+/);
  if (!first) return last ?? '—';
  return `${last} ${first[0]}.${middle ? ` ${middle[0]}.` : ''}`;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'КАМ',
  manager: 'Руководитель',
  admin: 'Администратор',
};

export const ROLE_HINTS: Record<UserRole, string> = {
  user: 'Видит вузы, закреплённые за собой',
  manager: 'Видит все вузы, назначает ответственных',
  admin: 'Полные права, доступ к журналу аудита',
};

export const AUDIT_LABELS: Record<AuditAction, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  read_pd: 'Просмотр перс. данных',
  import: 'Импорт',
  export: 'Выгрузка',
  login: 'Вход',
  access_denied: 'Отказ в доступе',
};

export const IMPORT_TARGET_LABELS: Record<ImportTarget, string> = {
  interactions: 'Взаимодействия',
  universities: 'Вузы',
  it_products: 'ИТ-продукты',
  contacts: 'Контакты вузов',
};

/** Entity table names as they appear in the audit log. */
export const ENTITY_LABELS: Record<string, string> = {
  universities: 'Вуз',
  university_contacts: 'Контакт вуза',
  kam_assignments: 'Назначение КАМа',
  vendors: 'Вендор',
  it_directions: 'ИТ-направление',
  it_products: 'ИТ-продукт',
  interactions: 'Взаимодействие',
  users: 'Сотрудник',
  // «Процесс», а не «Workflow»: так этот объект называется во всём остальном
  // интерфейсе (раздел «Процессы»), и журнал не должен быть единственным
  // местом, где он вдруг по-английски.
  workflows: 'Процесс',
  workflow_versions: 'Версия процесса',
  workflow_stages: 'Этап процесса',
  workflow_transitions: 'Переход процесса',
  import_jobs: 'Задача импорта',
  attachments: 'Вложение',
  interaction_stage_history: 'Перемещение карточки',
  workflow_stage_rename: 'Переименование этапа',
  workflow_stage_bulk_transfer: 'Перенос карточек между этапами',
  notification_rules: 'Правило уведомлений',
  notification_deliveries: 'Доставка уведомления',
  chat_messages: 'Сообщение',
  education_participants: 'Участник обучения',
  education_activities: 'Образовательное мероприятие',
};

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

/**
 * Подписи полей в diff-е журнала аудита. Журнал открыт администратору — это
 * технический специалист, а не разработчик, и читать `license_expires_at`
 * ему приходится со схемой БД под рукой. Неизвестные поля отдаются как есть.
 */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  short_name: 'Сокращение',
  full_name: 'ФИО',
  email: 'Email',
  phone: 'Телефон',
  position: 'Должность',
  region: 'Регион',
  inn: 'ИНН',
  comment: 'Комментарий',
  description: 'Описание',
  is_active: 'Активен',
  is_primary: 'Основной контакт',
  role: 'Роль',
  keycloak_id: 'Идентификатор Keycloak',
  visibility_mode: 'Режим видимости',
  contract_number: 'Номер договора',
  transfer_status: 'Статус передачи',
  license_signed_at: 'Лицензия подписана',
  license_expires_at: 'Лицензия действует до',
  license_years: 'Срок лицензии, лет',
  university_id: 'Вуз',
  it_direction_id: 'ИТ-направление',
  it_product_id: 'ИТ-продукт',
  vendor_id: 'Вендор',
  responsible_user_id: 'Ответственный',
  user_id: 'Сотрудник',
  current_stage_id: 'Текущий этап',
  workflow_version_id: 'Версия процесса',
  from_stage_id: 'Этап «откуда»',
  to_stage_id: 'Этап «куда»',
  assigned_from: 'Закреплён с',
  assigned_to: 'Закреплён по',
  filename: 'Файл',
  status: 'Статус',
  deleted_at: 'Удалено',
  workflow_transition_id: 'Переход процесса',
  stale_after_days: 'Срок бездействия, дней',
  recipient_kind: 'Тип получателя',
  recipient_role: 'Роль получателя',
  recipient_user_id: 'Получатель',
  channel: 'Канал',
  is_enabled: 'Включено',
  created_by: 'Создал',
  updated_by: 'Изменил',
  rule_id: 'Правило',
  interaction_id: 'Карточка',
  attempts: 'Попытки',
  sent_at: 'Отправлено',
  error_message: 'Ошибка доставки',
  payload: 'Данные уведомления',
};

const AUDIT_VALUE_LABELS: Record<string, Record<string, string>> = {
  channel: { email: 'Email', telegram: 'Telegram', max: 'MAX' },
  recipient_kind: {
    responsible: 'Ответственный',
    manager: 'Руководители',
    role: 'Роль',
    user: 'Пользователь',
  },
  is_enabled: { true: 'Да', false: 'Нет' },
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function auditValueLabel(field: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return AUDIT_VALUE_LABELS[field]?.[value] ?? value;
}

/**
 * How close a licence is to running out — drives the colour of the date in
 * every list, so an expiring contract is visible without opening the card.
 */
export type LicenseState = 'none' | 'expired' | 'soon' | 'active';

export function licenseState(expiresAt: string | null | undefined): LicenseState {
  if (!expiresAt) return 'none';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'none';
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= 90) return 'soon';
  return 'active';
}

export function daysUntil(dateValue: string): number {
  return Math.ceil((new Date(dateValue).getTime() - Date.now()) / 86_400_000);
}
