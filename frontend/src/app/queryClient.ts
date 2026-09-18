import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

/**
 * Shared cache for the whole app — this is the «кэш работы действий
 * пользователя» of FR-14: every list and card the user has opened stays warm,
 * so going back to a screen paints instantly and revalidates behind the scenes
 * instead of showing a spinner again.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalogs and cards change rarely during a working session; a minute of
      // freshness removes almost all redundant traffic while staying current.
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Retrying a 403 or a 404 only delays the message the user needs.
        if (error instanceof ApiError && error.status > 0 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Query keys in one place, so invalidation after a mutation can't drift. */
export const qk = {
  me: ['me'] as const,

  users: (params?: unknown) => ['users', params ?? {}] as const,
  user: (id: string) => ['users', 'one', id] as const,

  universities: (params?: unknown) => ['universities', params ?? {}] as const,
  university: (id: string) => ['universities', 'one', id] as const,
  universityContacts: (id: string) => ['universities', id, 'contacts'] as const,
  universityAssignments: (id: string) => ['universities', id, 'assignments'] as const,

  contacts: (params?: unknown) => ['contacts', params ?? {}] as const,
  vendors: (params?: unknown) => ['vendors', params ?? {}] as const,
  directions: (params?: unknown) => ['directions', params ?? {}] as const,
  products: (params?: unknown) => ['products', params ?? {}] as const,

  interactions: (params?: unknown) => ['interactions', params ?? {}] as const,
  interaction: (id: string) => ['interactions', 'one', id] as const,
  route: (id: string) => ['interactions', id, 'route'] as const,
  history: (id: string) => ['interactions', id, 'history'] as const,
  attachments: (id: string, stageId?: string) =>
    ['interactions', id, 'attachments', stageId ?? 'all'] as const,
  messages: (id: string) => ['interactions', id, 'messages'] as const,
  notifications: ['notifications'] as const,
  notificationRules: ['notification-rules'] as const,

  workflows: (params?: unknown) => ['workflows', params ?? {}] as const,
  workflow: (id: string) => ['workflows', 'one', id] as const,
  workflowVersions: (id: string) => ['workflows', id, 'versions'] as const,
  workflowGraph: (id: string, versionId?: string) =>
    ['workflows', id, 'graph', versionId ?? 'published'] as const,

  imports: (params?: unknown) => ['imports', params ?? {}] as const,
  importJob: (id: string) => ['imports', 'one', id] as const,
  importRows: (id: string, params?: unknown) => ['imports', id, 'rows', params ?? {}] as const,
  importPresets: (target?: string) => ['imports', 'presets', target ?? 'all'] as const,

  audit: (params?: unknown) => ['audit', params ?? {}] as const,
};
