/** Keycloak Authorization Code + PKCE session handling. */

const REALM_BASE = `${import.meta.env.VITE_KEYCLOAK_PATH ?? '/kc'}/realms/${
  import.meta.env.VITE_KEYCLOAK_REALM ?? 'crm'
}/protocol/openid-connect`;

const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'crm-web';
const STORAGE_KEY = 'crm.session';
const PKCE_STATE_KEY = 'crm.pkce.state';
const PKCE_VERIFIER_KEY = 'crm.pkce.verifier';
const RETURN_PATH_KEY = 'crm.pkce.return_path';
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

function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

function randomUrlValue(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return btoa(String.fromCharCode(...values))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
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
      throw new AuthError('Сеанс авторизации истёк. Запустите вход ещё раз.', 'expired');
    }
    throw new AuthError(payload.error_description ?? 'Не удалось войти в систему.');
  }
  return (await response.json()) as TokenResponse;
}

/** Starts the browser redirect to the Keycloak login screen. */
export async function beginSignIn(): Promise<void> {
  const state = randomUrlValue();
  const verifier = randomUrlValue(48);
  sessionStorage.setItem(PKCE_STATE_KEY, state);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_PATH_KEY, `${window.location.pathname}${window.location.search}`);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    state,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
  });
  window.location.assign(`${REALM_BASE}/auth?${params.toString()}`);
}

/** Completes the callback and consumes the one-time PKCE values. */
export async function completeSignIn(url = window.location.href): Promise<Session> {
  const params = new URL(url).searchParams;
  const error = params.get('error');
  if (error) {
    clearPkce();
    throw new AuthError(params.get('error_description') ?? 'Вход отменён.');
  }
  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!params.get('code') || !expectedState || !verifier || params.get('state') !== expectedState) {
    clearPkce();
    throw new AuthError('Не удалось проверить ответ авторизации. Запустите вход ещё раз.');
  }

  const session = toSession(
    await postForm({
      grant_type: 'authorization_code',
      code: params.get('code')!,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  );
  clearPkce();
  persist(session);
  return session;
}

function clearPkce(): void {
  sessionStorage.removeItem(PKCE_STATE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}

export function returnPath(): string {
  const path = sessionStorage.getItem(RETURN_PATH_KEY) ?? '/';
  sessionStorage.removeItem(RETURN_PATH_KEY);
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
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
    if (session.refreshExpiresAt && session.refreshExpiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function isCallback(): boolean {
  return window.location.pathname === '/auth/callback';
}

export function isExpiring(session: Session): boolean {
  return session.expiresAt - Date.now() < REFRESH_MARGIN_SECONDS * 1000;
}

export function msUntilRefresh(session: Session): number {
  return Math.max(5_000, session.expiresAt - Date.now() - REFRESH_MARGIN_SECONDS * 1000);
}

/** Realm roles carried by a token, useful for non-API landing decisions. */
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
