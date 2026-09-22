/** Typed wrappers over every endpoint the UI uses, grouped as the API groups them. */

import { api, type QueryParams } from './client';
import type {
  AssignmentCreate,
  AssignmentRead,
  AttachmentRead,
  AuditLogRead,
  AuditQuery,
  ContactCreate,
  ContactRead,
  ContactUpdate,
  CurrentUser,
  DirectionCreate,
  DirectionRead,
  ChatMessageCreate,
  ChatMessageRead,
  ImportCommitResult,
  ImportJobCreated,
  ImportJobRead,
  ImportRowRead,
  ImportRowStatus,
  ImportTarget,
  InteractionCreate,
  InteractionQuery,
  InteractionRead,
  InteractionUpdate,
  MappingRequest,
  MigrationPreview,
  MigrationPreviewRequest,
  NotificationDeliveryRead,
  NotificationRuleCreate,
  NotificationRuleRead,
  Page,
  PageQuery,
  PresetCreate,
  PresetRead,
  ProductCreate,
  ProductRead,
  RouteStartRequest,
  RouteView,
  PublishRequest,
  StageCreate,
  StageHistoryRead,
  StageRead,
  StageDeletePreview,
  StageDeleteRequest,
  StageRename,
  StageStructureUpdate,
  TransitionCreate,
  TransitionRead,
  TransitionRequest,
  UUID,
  UniversityCreate,
  UniversityRead,
  UniversityUpdate,
  UserCreate,
  UserRead,
  UserUpdate,
  UserVisibilityUpdate,
  VendorCreate,
  VendorRead,
  VersionCreate,
  VersionRead,
  WorkflowCreate,
  WorkflowGraph,
  WorkflowRead,
  WorkflowUpdate,
} from './types';

const q = (params: object | undefined) => params as QueryParams | undefined;

export const usersApi = {
  me: () => api.get<CurrentUser>('/users/me'),
  list: (params?: PageQuery) => api.get<Page<UserRead>>('/users', q(params)),
  get: (id: UUID) => api.get<UserRead>(`/users/${id}`),
  create: (body: UserCreate) => api.post<UserRead>('/users', body),
  update: (id: UUID, body: UserUpdate) => api.patch<UserRead>(`/users/${id}`, body),
  remove: (id: UUID) => api.delete(`/users/${id}`),
  visibility: (id: UUID) => api.get<UserVisibilityUpdate>(`/users/${id}/visibility`),
  updateVisibility: (id: UUID, body: UserVisibilityUpdate) =>
    api.patch<UserRead>(`/users/${id}/visibility`, body),
};

export const universitiesApi = {
  list: (params?: PageQuery) => api.get<Page<UniversityRead>>('/universities', q(params)),
  get: (id: UUID) => api.get<UniversityRead>(`/universities/${id}`),
  create: (body: UniversityCreate) => api.post<UniversityRead>('/universities', body),
  update: (id: UUID, body: UniversityUpdate) =>
    api.patch<UniversityRead>(`/universities/${id}`, body),
  remove: (id: UUID) => api.delete(`/universities/${id}`),

  contacts: (id: UUID, params?: PageQuery) =>
    api.get<Page<ContactRead>>(`/universities/${id}/contacts`, q(params)),
  addContact: (id: UUID, body: ContactCreate) =>
    api.post<ContactRead>(`/universities/${id}/contacts`, body),

  assignments: (id: UUID, params?: PageQuery) =>
    api.get<Page<AssignmentRead>>(`/universities/${id}/assignments`, q(params)),
  assign: (id: UUID, body: AssignmentCreate) =>
    api.post<AssignmentRead>(`/universities/${id}/assignments`, body),
};

export const contactsApi = {
  list: (params?: PageQuery & { university_id?: UUID }) =>
    api.get<Page<ContactRead>>('/university-contacts', q(params)),
  get: (id: UUID) => api.get<ContactRead>(`/university-contacts/${id}`),
  update: (id: UUID, body: ContactUpdate) =>
    api.patch<ContactRead>(`/university-contacts/${id}`, body),
  remove: (id: UUID) => api.delete(`/university-contacts/${id}`),
};

export const assignmentsApi = {
  /**
   * Closes the period rather than deleting it — the history stays readable.
   * The server stamps today's date; there is no parameter to override it.
   */
  close: (id: UUID) => api.delete<AssignmentRead>(`/assignments/${id}`),
};

export const vendorsApi = {
  list: (params?: PageQuery) => api.get<Page<VendorRead>>('/vendors', q(params)),
  get: (id: UUID) => api.get<VendorRead>(`/vendors/${id}`),
  create: (body: VendorCreate) => api.post<VendorRead>('/vendors', body),
  update: (id: UUID, body: Partial<VendorCreate>) =>
    api.patch<VendorRead>(`/vendors/${id}`, body),
  remove: (id: UUID) => api.delete(`/vendors/${id}`),
};

export const directionsApi = {
  list: (params?: PageQuery) => api.get<Page<DirectionRead>>('/it-directions', q(params)),
  get: (id: UUID) => api.get<DirectionRead>(`/it-directions/${id}`),
  create: (body: DirectionCreate) => api.post<DirectionRead>('/it-directions', body),
  update: (id: UUID, body: Partial<DirectionCreate>) =>
    api.patch<DirectionRead>(`/it-directions/${id}`, body),
  remove: (id: UUID) => api.delete(`/it-directions/${id}`),
};

export const productsApi = {
  list: (params?: PageQuery) => api.get<Page<ProductRead>>('/it-products', q(params)),
  get: (id: UUID) => api.get<ProductRead>(`/it-products/${id}`),
  create: (body: ProductCreate) => api.post<ProductRead>('/it-products', body),
  update: (id: UUID, body: Partial<ProductCreate>) =>
    api.patch<ProductRead>(`/it-products/${id}`, body),
  remove: (id: UUID) => api.delete(`/it-products/${id}`),
};

export const interactionsApi = {
  list: (params?: InteractionQuery) => api.get<Page<InteractionRead>>('/interactions', q(params)),
  get: (id: UUID) => api.get<InteractionRead>(`/interactions/${id}`),
  create: (body: InteractionCreate) => api.post<InteractionRead>('/interactions', body),
  update: (id: UUID, body: InteractionUpdate) =>
    api.patch<InteractionRead>(`/interactions/${id}`, body),
  remove: (id: UUID) => api.delete(`/interactions/${id}`),

  route: (id: UUID) => api.get<RouteView>(`/interactions/${id}/route`),
  startRoute: (id: UUID, body?: RouteStartRequest) =>
    api.post<RouteView>(`/interactions/${id}/route/start`, body ?? {}),
  transition: (id: UUID, body: TransitionRequest) =>
    api.post<RouteView>(`/interactions/${id}/transitions`, body),
  history: (id: UUID) => api.get<StageHistoryRead[]>(`/interactions/${id}/history`),
  messages: (id: UUID) => api.get<ChatMessageRead[]>(`/interactions/${id}/messages`),
  sendMessage: (id: UUID, body: ChatMessageCreate) =>
    api.post<ChatMessageRead>(`/interactions/${id}/messages`, body),
  sendMessageWithAttachments: (id: UUID, body: string, files: File[]) => {
    const form = new FormData();
    form.append('body', body);
    files.forEach((file) => form.append('files', file));
    return api.upload<ChatMessageRead>(`/interactions/${id}/messages/with-attachments`, form);
  },
  attachments: (id: UUID, params?: PageQuery & { stage_id?: UUID }) =>
    api.get<Page<AttachmentRead>>(`/interactions/${id}/attachments`, q(params)),
  attach: (id: UUID, stageId: UUID, file: File, comment?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (comment) form.append('comment', comment);
    return api.upload<AttachmentRead>(`/interactions/${id}/stages/${stageId}/attachments`, form);
  },
};

export const notificationsApi = {
  list: () => api.get<NotificationDeliveryRead[]>('/notifications'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  deliver: () => api.post<{ processed: number }>('/notifications/deliver'),
  rules: () => api.get<NotificationRuleRead[]>('/notification-rules'),
  createRule: (body: NotificationRuleCreate) =>
    api.post<NotificationRuleRead>('/notification-rules', body),
  removeRule: (id: string) => api.delete(`/notification-rules/${id}`),
};

export const attachmentsApi = {
  get: (id: UUID) => api.get<AttachmentRead>(`/attachments/${id}`),
  remove: (id: UUID) => api.delete(`/attachments/${id}`),
  download: (id: UUID) => api.download(`/attachments/${id}/download`),
};

export const workflowsApi = {
  list: (params?: PageQuery) => api.get<Page<WorkflowRead>>('/workflows', q(params)),
  get: (id: UUID) => api.get<WorkflowRead>(`/workflows/${id}`),
  create: (body: WorkflowCreate) => api.post<WorkflowRead>('/workflows', body),
  update: (id: UUID, body: WorkflowUpdate) => api.patch<WorkflowRead>(`/workflows/${id}`, body),
  remove: (id: UUID) => api.delete(`/workflows/${id}`),

  versions: (id: UUID) => api.get<VersionRead[]>(`/workflows/${id}/versions`),
  createVersion: (id: UUID, body?: VersionCreate) =>
    api.post<VersionRead>(`/workflows/${id}/versions`, body ?? {}),
  publish: (id: UUID, versionId: UUID) =>
    api.post<VersionRead>(`/workflows/${id}/versions/${versionId}/publish`),
  migrationPreview: (id: UUID, versionId: UUID, body: MigrationPreviewRequest) =>
    api.post<MigrationPreview>(`/workflows/${id}/versions/${versionId}/migration-preview`, body),
  publishWithMigration: (id: UUID, versionId: UUID, body: PublishRequest) =>
    api.post<VersionRead>(`/workflows/${id}/versions/${versionId}/publish`, body),

  graph: (id: UUID) => api.get<WorkflowGraph>(`/workflows/${id}/graph`),
  versionGraph: (id: UUID, versionId: UUID) =>
    api.get<WorkflowGraph>(`/workflows/${id}/versions/${versionId}/graph`),

  stages: (id: UUID, versionId: UUID) =>
    api.get<StageRead[]>(`/workflows/${id}/versions/${versionId}/stages`),
  addStage: (id: UUID, versionId: UUID, body: StageCreate) =>
    api.post<StageRead>(`/workflows/${id}/versions/${versionId}/stages`, body),

  transitions: (id: UUID, versionId: UUID) =>
    api.get<TransitionRead[]>(`/workflows/${id}/versions/${versionId}/transitions`),
  addTransition: (id: UUID, versionId: UUID, body: TransitionCreate) =>
    api.post<TransitionRead>(`/workflows/${id}/versions/${versionId}/transitions`, body),
};

export const stagesApi = {
  rename: (id: UUID, body: StageRename) => api.patch<StageRead>(`/workflow-stages/${id}`, body),
  updateStructure: (id: UUID, body: StageStructureUpdate) =>
    api.patch<StageRead>(`/workflow-stages/${id}/structure`, body),
  deletePreview: (id: UUID) => api.get<StageDeletePreview>(`/workflow-stages/${id}/delete-preview`),
  remove: (id: UUID, body: StageDeleteRequest) =>
    api.deleteWithBody(`/workflow-stages/${id}`, body),
};

export const chatAttachmentsApi = {
  download: (id: UUID) => api.download(`/chat-attachments/${id}/download`),
};

export const transitionsApi = {
  remove: (id: UUID) => api.delete(`/workflow-transitions/${id}`),
};

export const importsApi = {
  list: (params?: PageQuery) => api.get<Page<ImportJobRead>>('/imports', q(params)),
  get: (jobId: UUID) => api.get<ImportJobRead>(`/imports/${jobId}`),

  upload: (file: File, target: ImportTarget) => {
    const form = new FormData();
    form.append('file', file);
    form.append('target', target);
    return api.upload<ImportJobCreated>('/imports', form);
  },

  setMapping: (jobId: UUID, body: MappingRequest) =>
    api.post<ImportJobRead>(`/imports/${jobId}/mapping`, body),
  validate: (jobId: UUID) => api.post<ImportCommitResult>(`/imports/${jobId}/validate`),
  rows: (jobId: UUID, params?: { status?: ImportRowStatus; page?: number; size?: number }) =>
    api.get<Page<ImportRowRead>>(`/imports/${jobId}/rows`, q(params)),
  commit: (jobId: UUID) => api.post<ImportCommitResult>(`/imports/${jobId}/commit`),
  report: (jobId: UUID) => api.download(`/imports/${jobId}/report`),

  presets: (params?: { target?: ImportTarget; page?: number; size?: number }) =>
    api.get<Page<PresetRead>>('/imports/presets', q(params)),
  savePreset: (body: PresetCreate) => api.post<PresetRead>('/imports/presets', body),
};

export const auditApi = {
  list: (params?: AuditQuery) => api.get<Page<AuditLogRead>>('/audit', q(params)),
};
