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
  workflows: 'Workflow',
  workflow_versions: 'Версия workflow',
  workflow_stages: 'Этап',
  workflow_transitions: 'Переход',
  import_jobs: 'Задача импорта',
  attachments: 'Вложение',
  interaction_stage_history: 'Перемещение карточки',
};

export function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
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
