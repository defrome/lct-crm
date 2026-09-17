/**
 * Keycloak session handling.
 *
 * The realm is reached through this origin (`/kc/...`), proxied by the dev
 * server and by nginx in the container. That side-steps two things at once:
 * the realm client only whitelists its own web origin, and the API has no CORS
 * middleware — from the browser's point of view everything is same-origin.
 *
 * Flow is the resource-owner password grant against the public `crm-api`
 * client, which the realm already enables. The sign-in form lives in the app,
 * matching the ТЗ's UX-PATH step 1 («пользователь попал на окно авторизации»).
 * To switch to the redirect + PKCE flow instead, register a public client with
 * this origin in its redirect URIs and swap `requestToken` for an
 * authorization-code exchange — nothing outside this module depends on which
 * grant produced the token.
 */

const REALM_BASE = `${import.meta.env.VITE_KEYCLOAK_PATH ?? '/kc'}/realms/${
  import.meta.env.VITE_KEYCLOAK_REALM ?? 'crm'
}/protocol/openid-connect`;

const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'crm-api';
const STORAGE_KEY = 'crm.session';

/** Refresh this many seconds before the access token actually expires. */
const REFRESH_MARGIN_SECONDS = 45;

export interface Session {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
  refreshExpiresAt: number | null;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly kind: 'credentials' | 'network' | 'expired' = 'credentials',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function toSession(data: TokenResponse): Session {
  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: now + data.expires_in * 1000,
    refreshExpiresAt: data.refresh_expires_in ? now + data.refresh_expires_in * 1000 : null,
  };
}

async function postForm(body: Record<string, string>): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(`${REALM_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
    });
  } catch {
    throw new AuthError('Сервер авторизации недоступен. Проверьте подключение.', 'network');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      error_description?: string;
    };
    if (payload.error === 'invalid_grant') {
      throw new AuthError('Неверный логин или пароль.', 'credentials');
    }
    throw new AuthError(payload.error_description ?? 'Не удалось войти в систему.', 'credentials');
  }

  return (await response.json()) as TokenResponse;
}

export async function signIn(username: string, password: string): Promise<Session> {
  const session = toSession(
    await postForm({ grant_type: 'password', username: username.trim(), password, scope: 'openid' }),
  );
  persist(session);
  return session;
}

export async function refresh(session: Session): Promise<Session> {
  if (!session.refreshToken) throw new AuthError('Сессия истекла. Войдите заново.', 'expired');
  try {
    const next = toSession(
      await postForm({ grant_type: 'refresh_token', refresh_token: session.refreshToken }),
    );
    persist(next);
    return next;
  } catch (error) {
    if (error instanceof AuthError && error.kind === 'network') throw error;
    clear();
    throw new AuthError('Сессия истекла. Войдите заново.', 'expired');
  }
}

export async function signOut(session: Session | null): Promise<void> {
  clear();
  if (!session?.refreshToken) return;
  // Best effort: revoking server-side is nice but never blocks leaving.
  await fetch(`${REALM_BASE}/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: session.refreshToken }),
  }).catch(() => undefined);
}

export function persist(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clear(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function restore(): Session | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.accessToken) return null;
    // A dead refresh token cannot revive the session, so treat it as absent.
    if (session.refreshExpiresAt && session.refreshExpiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function isExpiring(session: Session): boolean {
  return session.expiresAt - Date.now() < REFRESH_MARGIN_SECONDS * 1000;
}

/** Milliseconds until this session should be refreshed, floored at 5s. */
export function msUntilRefresh(session: Session): number {
  return Math.max(5_000, session.expiresAt - Date.now() - REFRESH_MARGIN_SECONDS * 1000);
}

/** Realm roles carried by the token, used to pick the landing screen early. */
export function rolesFromToken(accessToken: string): string[] {
  try {
    const [, payload] = accessToken.split('.');
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      realm_access?: { roles?: string[] };
    };
    return claims.realm_access?.roles ?? [];
  } catch {
    return [];
  }
}
