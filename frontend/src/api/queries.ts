/** React Query hooks over `endpoints.ts`, one per screen need. */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { qk } from '@/app/queryClient';
import {
  auditApi,
  contactsApi,
  directionsApi,
  importsApi,
  interactionsApi,
  notificationsApi,
  productsApi,
  universitiesApi,
  usersApi,
  vendorsApi,
  workflowsApi,
} from './endpoints';
import type {
  AuditQuery,
  ImportRowStatus,
  ImportTarget,
  InteractionQuery,
  PageQuery,
  UUID,
} from './types';

/** Catalog lookups feed pickers on almost every screen, so they stay fresh longer. */
const CATALOG = { staleTime: 5 * 60_000 } satisfies Partial<UseQueryOptions>;

export function useUniversities(params: PageQuery = {}) {
  return useQuery({
    queryKey: qk.universities(params),
    queryFn: () => universitiesApi.list(params),
  });
}

export function useUniversity(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.university(id!),
    queryFn: () => universitiesApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useUniversityContacts(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.universityContacts(id!),
    queryFn: () => universitiesApi.contacts(id!, { size: 200 }),
    enabled: Boolean(id),
  });
}

export function useUniversityAssignments(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.universityAssignments(id!),
    queryFn: () => universitiesApi.assignments(id!, { size: 200, sort: '-assigned_from' }),
    enabled: Boolean(id),
  });
}

export function useContacts(params: PageQuery & { university_id?: UUID } = {}) {
  return useQuery({ queryKey: qk.contacts(params), queryFn: () => contactsApi.list(params) });
}

export function useVendors(params: PageQuery = {}) {
  return useQuery({
    queryKey: qk.vendors(params),
    queryFn: () => vendorsApi.list(params),
    ...CATALOG,
  });
}

export function useDirections(params: PageQuery = {}) {
  return useQuery({
    queryKey: qk.directions(params),
    queryFn: () => directionsApi.list(params),
    ...CATALOG,
  });
}

export function useProducts(params: PageQuery = {}) {
  return useQuery({
    queryKey: qk.products(params),
    queryFn: () => productsApi.list(params),
    ...CATALOG,
  });
}

export function useUsers(params: PageQuery = {}) {
  return useQuery({ queryKey: qk.users(params), queryFn: () => usersApi.list(params), ...CATALOG });
}

export function useInteractions(params: InteractionQuery = {}) {
  return useQuery({
    queryKey: qk.interactions(params),
    queryFn: () => interactionsApi.list(params),
    // Keeps the previous page on screen while the next one loads, so paging and
    // filtering never blank the table out.
    placeholderData: (previous) => previous,
  });
}

export function useInteraction(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.interaction(id!),
    queryFn: () => interactionsApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useRoute(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.route(id!),
    queryFn: () => interactionsApi.route(id!),
    enabled: Boolean(id),
  });
}

export function useAttachments(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.attachments(id!),
    queryFn: () => interactionsApi.attachments(id!, { size: 200 }),
    enabled: Boolean(id),
  });
}

export function useMessages(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.messages(id!),
    queryFn: () => interactionsApi.messages(id!),
    enabled: Boolean(id),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications,
    queryFn: notificationsApi.list,
    refetchInterval: 60_000,
  });
}

export function useNotificationRules() {
  return useQuery({
    queryKey: qk.notificationRules,
    queryFn: notificationsApi.rules,
  });
}

export function useWorkflows(params: PageQuery = {}) {
  return useQuery({
    queryKey: qk.workflows(params),
    queryFn: () => workflowsApi.list(params),
    ...CATALOG,
  });
}

export function useWorkflow(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.workflow(id!),
    queryFn: () => workflowsApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useWorkflowVersions(id: UUID | undefined) {
  return useQuery({
    queryKey: qk.workflowVersions(id!),
    queryFn: () => workflowsApi.versions(id!),
    enabled: Boolean(id),
  });
}

export function useWorkflowGraph(id: UUID | undefined, versionId?: UUID) {
  return useQuery({
    queryKey: qk.workflowGraph(id!, versionId),
    queryFn: () => (versionId ? workflowsApi.versionGraph(id!, versionId) : workflowsApi.graph(id!)),
    enabled: Boolean(id),
  });
}

export function useImportJobs(params: PageQuery = {}) {
  return useQuery({ queryKey: qk.imports(params), queryFn: () => importsApi.list(params) });
}

export function useImportJob(jobId: UUID | undefined) {
  return useQuery({
    queryKey: qk.importJob(jobId!),
    queryFn: () => importsApi.get(jobId!),
    enabled: Boolean(jobId),
  });
}

export function useImportRows(
  jobId: UUID | undefined,
  params: { status?: ImportRowStatus; page?: number; size?: number } = {},
) {
  return useQuery({
    queryKey: qk.importRows(jobId!, params),
    queryFn: () => importsApi.rows(jobId!, params),
    enabled: Boolean(jobId),
    placeholderData: (previous) => previous,
  });
}

export function useImportPresets(target?: ImportTarget) {
  return useQuery({
    queryKey: qk.importPresets(target),
    queryFn: () => importsApi.presets({ target, size: 100 }),
  });
}

export function useAudit(params: AuditQuery = {}) {
  return useQuery({
    queryKey: qk.audit(params),
    queryFn: () => auditApi.list(params),
    placeholderData: (previous) => previous,
    // Audit entries are append-only and can be created by another user while
    // the administrator keeps this page open.
    refetchInterval: 15_000,
  });
}
