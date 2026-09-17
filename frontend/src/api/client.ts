/**
 * HTTP client for the CRM API.
 *
 * Every response error is normalised into `ApiError`, which carries the API's
 * own `{error: {code, message, request_id}}` contract — so a toast can show the
 * server's Russian message and a bug report can quote the request id.
 *
 * A 401 is retried exactly once behind a token refresh: several queries firing
 * at the moment a token expires would otherwise each trigger their own refresh
 * and race, so the refresh promise is shared.
 */

import type { ApiErrorBody } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAccessDenied(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Field-level messages from a 422, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const fields = this.details?.fields;
    if (!Array.isArray(fields)) return {};
    const result: Record<string, string> = {};
    for (const item of fields as { loc?: string[]; msg?: string }[]) {
      const name = item.loc?.filter((part) => part !== 'body').join('.');
      if (name && item.msg) result[name] = item.msg;
    }
    return result;
  }
}

/** Filled in by the auth provider; keeps React state out of this module. */
interface AuthBridge {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
  onSessionLost: () => void;
}

let auth: AuthBridge = {
  getToken: () => null,
  refresh: async () => null,
  onSessionLost: () => undefined,
};

export function connectAuth(bridge: AuthBridge): void {
  auth = bridge;
}

let pendingRefresh: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  pendingRefresh ??= auth.refresh().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | (string | number)[]
>;

export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: QueryParams;
  /** Send `body` as-is (FormData) instead of JSON-encoding it. */
  raw?: boolean;
  signal?: AbortSignal;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    const payload = (await response.json()) as { error?: ApiErrorBody };
    body = payload.error ?? {};
  } catch {
    /* an empty or non-JSON body still becomes a usable error below */
  }
  const fallback =
    response.status >= 500
      ? 'Сервер не смог обработать запрос. Попробуйте ещё раз.'
      : 'Запрос не выполнен.';
  return new ApiError(
    response.status,
    body.code ?? `HTTP_${response.status}`,
    body.message ?? fallback,
    body.details,
    body.request_id ?? response.headers.get('X-Request-ID'),
  );
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined && !options.raw) headers['Content-Type'] = 'application/json';

  return fetch(`${BASE}${path}${buildQuery(options.params)}`, {
    method: options.method ?? 'GET',
    headers,
    signal: options.signal,
    body:
      options.body === undefined
        ? undefined
        : options.raw
          ? (options.body as BodyInit)
          : JSON.stringify(options.body),
  });
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  let response: Response;
  try {
    response = await send(path, options, auth.getToken());
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Сервер недоступен. Проверьте подключение.');
  }

  if (response.status === 401) {
    const token = await refreshOnce();
    if (!token) {
      auth.onSessionLost();
      throw await toApiError(response);
    }
    response = await send(path, options, token);
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

async function json<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await request(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    json<T>(path, { params, signal }),

  post: <T>(path: string, body?: unknown, params?: QueryParams) =>
    json<T>(path, { method: 'POST', body, params }),

  patch: <T>(path: string, body?: unknown) => json<T>(path, { method: 'PATCH', body }),

  delete: <T = void>(path: string, params?: QueryParams) =>
    json<T>(path, { method: 'DELETE', params }),

  upload: <T>(path: string, form: FormData, params?: QueryParams) =>
    json<T>(path, { method: 'POST', body: form, raw: true, params }),

  /** Fetches a file and hands back the blob plus the server's filename. */
  async download(path: string, params?: QueryParams): Promise<{ blob: Blob; filename?: string }> {
    const response = await request(path, { params });
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return {
      blob: await response.blob(),
      filename: match ? decodeURIComponent(match[1]) : undefined,
    };
  },
};
