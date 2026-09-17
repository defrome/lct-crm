import type { ImportTarget } from '@/api/types';

/**
 * Destination fields the mapping step can choose from.
 *
 * Mirrors `app/imports/mapping.py` in the backend, which owns the catalogue but
 * does not publish it through the API — `/imports` only returns a *suggested*
 * mapping, never the full list of what a column may be mapped to. Titles are the
 * customer's own column headings and must not be reworded; keep this list in
 * step with `FIELDS_BY_TARGET` if the backend gains a field.
 */
export interface TargetField {
  /** `table.column`, the value the API expects in the mapping. */
  path: string;
  title: string;
  required?: boolean;
  /** Which part of the record this writes to, used to group the picker. */
  group: string;
}

const UNIVERSITY_NAME: TargetField = {
  path: 'universities.name',
  title: 'Название ВУЗа',
  required: true,
  group: 'Вуз',
};

const INTERACTION_FIELDS: TargetField[] = [
  UNIVERSITY_NAME,
  { path: 'vendors.name', title: 'Вендор', group: 'Каталог' },
  { path: 'it_products.name', title: 'ПО', group: 'Каталог' },
  { path: 'it_directions.name', title: 'ИТ-направление', group: 'Каталог' },
  { path: 'interactions.contract_number', title: 'Номер договора', group: 'Договор' },
  { path: 'interactions.license_signed_at', title: 'Подписание лицензии', group: 'Договор' },
  {
    path: 'interactions.license_years',
    title: 'Срок действия лицензии (год)',
    group: 'Договор',
  },
  { path: 'interactions.transfer_status', title: 'Статус по передаче', group: 'Работа' },
  { path: 'interactions.responsible_user_id', title: 'ФИО Менеджера', group: 'Работа' },
  { path: 'university_contacts.full_name', title: 'Ответственные от ВУЗа', group: 'Вуз' },
  { path: 'interactions.comment', title: 'Комментарий', group: 'Работа' },
];

const UNIVERSITY_FIELDS: TargetField[] = [
  UNIVERSITY_NAME,
  { path: 'universities.short_name', title: 'Сокращённое название', group: 'Вуз' },
  { path: 'universities.region', title: 'Регион', group: 'Вуз' },
  { path: 'universities.inn', title: 'ИНН', group: 'Вуз' },
  { path: 'universities.external_id', title: 'Внешний ID', group: 'Вуз' },
  { path: 'universities.comment', title: 'Комментарий', group: 'Вуз' },
];

const IT_PRODUCT_FIELDS: TargetField[] = [
  { path: 'it_products.name', title: 'ПО', required: true, group: 'Продукт' },
  { path: 'vendors.name', title: 'Вендор', group: 'Продукт' },
  { path: 'it_directions.name', title: 'ИТ-направление', group: 'Продукт' },
  { path: 'it_products.description', title: 'Описание', group: 'Продукт' },
];

const CONTACT_FIELDS: TargetField[] = [
  UNIVERSITY_NAME,
  {
    path: 'university_contacts.full_name',
    title: 'ФИО',
    required: true,
    group: 'Контакт',
  },
  { path: 'university_contacts.position', title: 'Должность', group: 'Контакт' },
  { path: 'university_contacts.email', title: 'Email', group: 'Контакт' },
  { path: 'university_contacts.phone', title: 'Телефон', group: 'Контакт' },
];

export const FIELDS_BY_TARGET: Record<ImportTarget, TargetField[]> = {
  interactions: INTERACTION_FIELDS,
  universities: UNIVERSITY_FIELDS,
  it_products: IT_PRODUCT_FIELDS,
  contacts: CONTACT_FIELDS,
};

export function fieldTitle(target: ImportTarget, path: string): string {
  return FIELDS_BY_TARGET[target].find((field) => field.path === path)?.title ?? path;
}

/** Which import targets exist, with a sentence explaining what each one loads. */
export const TARGET_OPTIONS: { value: ImportTarget; label: string; hint: string }[] = [
  {
    value: 'interactions',
    label: 'Взаимодействия',
    hint: 'Основной каталог: вуз, направление, продукт, договор и статус — одной строкой',
  },
  {
    value: 'universities',
    label: 'Вузы',
    hint: 'Справочник вузов с регионом, ИНН и внешним идентификатором',
  },
  {
    value: 'it_products',
    label: 'ИТ-продукты',
    hint: 'Каталог ПО с вендорами и направлениями',
  },
  {
    value: 'contacts',
    label: 'Контакты вузов',
    hint: 'Сотрудники вузов: ФИО, должность, рабочие контакты',
  },
];
