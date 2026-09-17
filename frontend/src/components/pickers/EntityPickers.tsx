import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useDirections, useProducts, useUniversities, useUsers, useVendors } from '@/api/queries';
import { directionsApi, productsApi, universitiesApi, usersApi } from '@/api/endpoints';
import type { UUID } from '@/api/types';
import { Combobox, type Option } from '@/components/ui/Combobox';
import { useDebounced } from '@/hooks';
import { ROLE_LABELS } from '@/lib/format';

interface PickerProps {
  value: UUID | null;
  onChange: (value: UUID | null) => void;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onCreate?: (name: string) => void;
  createLabel?: string;
}

/**
 * A selected record can sit outside the current search results — an old
 * assignment, a card opened from a link. This fetches it by id so the control
 * shows a name instead of a blank, without widening the search request.
 */
function useSelectedOption(
  value: UUID | null,
  options: Option[],
  fetch: (id: UUID) => Promise<Option>,
  scope: string,
): Option[] {
  const missing = Boolean(value) && !options.some((option) => option.value === value);
  const { data } = useQuery({
    queryKey: [scope, 'picker-selected', value],
    queryFn: () => fetch(value!),
    enabled: missing,
    staleTime: 5 * 60_000,
  });
  return data ? [data, ...options] : options;
}

export function UniversityPicker(props: PickerProps) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const { data, isFetching } = useUniversities({ search: query || undefined, size: 30, sort: 'name' });

  const base: Option[] = (data?.items ?? []).map((university) => ({
    value: university.id,
    label: university.short_name ?? university.name,
    detail: university.short_name ? university.name : (university.region ?? undefined),
  }));

  const options = useSelectedOption(
    props.value,
    base,
    async (id) => {
      const university = await universitiesApi.get(id);
      return {
        value: university.id,
        label: university.short_name ?? university.name,
        detail: university.short_name ? university.name : (university.region ?? undefined),
      };
    },
    'universities',
  );

  return (
    <Combobox
      {...props}
      options={options}
      onSearch={setSearch}
      loading={isFetching}
      placeholder={props.placeholder ?? 'Выберите вуз'}
      createLabel={props.createLabel ?? 'Создать вуз'}
    />
  );
}

export function ProductPicker(props: PickerProps) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const { data, isFetching } = useProducts({ search: query || undefined, size: 30, sort: 'name' });

  const base: Option[] = (data?.items ?? []).map((product) => ({
    value: product.id,
    label: product.name,
    detail: product.vendor?.name,
  }));

  const options = useSelectedOption(
    props.value,
    base,
    async (id) => {
      const product = await productsApi.get(id);
      return { value: product.id, label: product.name, detail: product.vendor?.name };
    },
    'products',
  );

  return (
    <Combobox
      {...props}
      options={options}
      onSearch={setSearch}
      loading={isFetching}
      placeholder={props.placeholder ?? 'Выберите ИТ-продукт'}
      createLabel={props.createLabel ?? 'Создать продукт'}
    />
  );
}

export function DirectionPicker(props: PickerProps) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const { data, isFetching } = useDirections({ search: query || undefined, size: 50, sort: 'name' });

  const base: Option[] = (data?.items ?? []).map((direction) => ({
    value: direction.id,
    label: direction.name,
    detail: direction.description ?? undefined,
  }));

  const options = useSelectedOption(
    props.value,
    base,
    async (id) => {
      const direction = await directionsApi.get(id);
      return { value: direction.id, label: direction.name };
    },
    'directions',
  );

  return (
    <Combobox
      {...props}
      options={options}
      onSearch={setSearch}
      loading={isFetching}
      placeholder={props.placeholder ?? 'Выберите направление'}
      createLabel={props.createLabel ?? 'Создать направление'}
    />
  );
}

export function UserPicker(props: PickerProps) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const { data, isFetching } = useUsers({ search: query || undefined, size: 30, sort: 'full_name' });

  const base: Option[] = (data?.items ?? []).map((user) => ({
    value: user.id,
    label: user.full_name,
    detail: ROLE_LABELS[user.role],
  }));

  const options = useSelectedOption(
    props.value,
    base,
    async (id) => {
      const user = await usersApi.get(id);
      return { value: user.id, label: user.full_name, detail: ROLE_LABELS[user.role] };
    },
    'users',
  );

  return (
    <Combobox
      {...props}
      options={options}
      onSearch={setSearch}
      loading={isFetching}
      placeholder={props.placeholder ?? 'Выберите сотрудника'}
    />
  );
}

export function VendorPicker(props: PickerProps) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const { data, isFetching } = useVendors({ search: query || undefined, size: 50, sort: 'name' });

  return (
    <Combobox
      {...props}
      options={(data?.items ?? []).map((vendor) => ({ value: vendor.id, label: vendor.name }))}
      onSearch={setSearch}
      loading={isFetching}
      placeholder={props.placeholder ?? 'Выберите вендора'}
      createLabel={props.createLabel ?? 'Создать вендора'}
    />
  );
}
