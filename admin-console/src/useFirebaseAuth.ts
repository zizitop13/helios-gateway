import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from './firebase';

interface UseFirebaseAuthResult {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useFirebaseAuth(): UseFirebaseAuthResult {
  if (!firebaseAuth) {
    throw new Error('Firebase auth is not initialized. Call initializeFirebaseAuth() before rendering the app.');
  }

  const auth = firebaseAuth;
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('adminToken'));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setError(null);
        setUser(firebaseUser);

        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          localStorage.setItem('adminToken', idToken);
        } else {
          setToken(null);
          localStorage.removeItem('adminToken');
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to refresh authentication token';
        setError(message);
        setToken(null);
        localStorage.removeItem('adminToken');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const loginWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      setToken(idToken);
      localStorage.setItem('adminToken', idToken);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setError(message);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setToken(null);
    setUser(null);
    localStorage.removeItem('adminToken');
  };

  return { token, user, loading, error, loginWithEmail, logout };
}
