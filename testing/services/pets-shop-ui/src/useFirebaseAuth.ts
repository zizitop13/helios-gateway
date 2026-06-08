import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
  type IdTokenResult,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';
import { clearGatewaySession, syncGatewaySession } from './api';

interface UseFirebaseAuthResult {
  token: string | null;
  user: User | null;
  roles: string[];
  loading: boolean;
  error: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

function parseRoles(tokenResult: IdTokenResult): string[] {
  const claimCandidates = [
    tokenResult.claims.roles,
    tokenResult.claims.role,
    (tokenResult.claims.custom_claims as { roles?: unknown } | undefined)?.roles,
  ];

  const roles = claimCandidates.flatMap((candidate) => {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is string => typeof entry === 'string');
    }
    if (typeof candidate === 'string') {
      return [candidate];
    }
    return [];
  });

  const normalizedRoles = roles
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);

  return [...new Set(normalizedRoles)];
}

export function useFirebaseAuth(): UseFirebaseAuthResult {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateUserToken = async (firebaseUser: User) => {
    const idTokenResult = await firebaseUser.getIdTokenResult();
    await syncGatewaySession(idTokenResult.token);
    setToken(idTokenResult.token);
    setRoles(parseRoles(idTokenResult));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          await updateUserToken(firebaseUser);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to establish gateway session';
          setError(message);
          setToken(null);
          setRoles([]);
        }
      } else {
        setToken(null);
        setRoles([]);
        try {
          await clearGatewaySession();
        } catch {
          // Ignore cleanup errors for signed-out users.
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await updateUserToken(credential.user);
      setUser(credential.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await clearGatewaySession();
    } catch {
      // Ignore session cleanup failure and continue sign-out.
    }
    await signOut(firebaseAuth);
    setToken(null);
    setUser(null);
    setRoles([]);
  };

  const refreshToken = async () => {
    if (!firebaseAuth.currentUser) {
      return;
    }

    const result = await firebaseAuth.currentUser.getIdTokenResult(true);
    await syncGatewaySession(result.token);
    setToken(result.token);
    setRoles(parseRoles(result));
  };

  return { token, user, roles, loading, error, loginWithEmail, logout, refreshToken };
}
