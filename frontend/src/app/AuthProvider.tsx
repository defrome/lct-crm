import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import * as kc from '@/api/auth';
import { connectAuth } from '@/api/client';
import { usersApi } from '@/api/endpoints';
import { queryClient } from '@/app/queryClient';
import type { CurrentUser, UserRole } from '@/api/types';

interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: CurrentUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** True when the user's role is at least `role` in the user < manager < admin order. */
  can: (role: UserRole) => boolean;
  authError: string | null;
}

const RANK: Record<UserRole, number> = { user: 0, manager: 1, admin: 2 };

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth используется вне AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<kc.Session | null>(() => kc.restore());
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>(() =>
    kc.isCallback() || kc.restore() ? 'loading' : 'anonymous',
  );
  const [authError, setAuthError] = useState<string | null>(null);

  // The API client reads the token synchronously on every request, so it needs a
  // ref rather than a value captured in a closure. Every path that changes the
  // session updates both, which is why this is seeded once and never written
  // during render.
  const sessionRef = useRef(session);
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (!kc.isCallback() || callbackHandled.current) return;
    callbackHandled.current = true;
    let cancelled = false;
    kc.completeSignIn()
      .then((next) => {
        if (cancelled) return;
        const path = kc.returnPath();
        sessionRef.current = next;
        setSession(next);
        setStatus('loading');
        window.location.replace(path);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAuthError(error instanceof kc.AuthError ? error.message : 'Не удалось войти в систему.');
        window.history.replaceState(null, '', '/login');
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const endSession = useCallback(() => {
    kc.clear();
    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, []);

  // Bridge the token into the API client once; the closures read the ref.
  useEffect(() => {
    connectAuth({
      getToken: () => sessionRef.current?.accessToken ?? null,
      refresh: async () => {
        const current = sessionRef.current;
        if (!current) return null;
        try {
          const next = await kc.refresh(current);
          sessionRef.current = next;
          setSession(next);
          return next.accessToken;
        } catch {
          return null;
        }
      },
      onSessionLost: endSession,
    });
  }, [endSession]);

  // Keep the access token alive for as long as the refresh token allows, so a
  // long working session never drops the user on a form mid-edit.
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      kc.refresh(session)
        .then((next) => {
          sessionRef.current = next;
          setSession(next);
        })
        .catch(() => endSession());
    }, kc.msUntilRefresh(session));
    return () => clearTimeout(timer);
  }, [session, endSession]);

  // Resolve the identity the API knows about — roles and scope come from the
  // server's own projection, not from the token's claims.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    usersApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) endSession();
      });
    return () => {
      cancelled = true;
    };
  }, [session, endSession]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    await kc.beginSignIn();
  }, []);

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    endSession();
    await kc.signOut(current);
  }, [endSession]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      signIn,
      signOut,
      can: (role) => (user ? RANK[user.role] >= RANK[role] : false),
      authError,
    }),
    [status, user, signIn, signOut, authError],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
