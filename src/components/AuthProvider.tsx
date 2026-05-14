'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api, readStoredUser, writeStoredUser, type StoredUser } from '@/lib/api';
import { auth as firebaseAuth } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

type AuthState = {
  user: StoredUser | null;
  isAdmin: boolean;
  adminMode: 'open' | 'restricted' | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMode, setAdminMode] = useState<'open' | 'restricted' | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const stored = readStoredUser();
    setUser(stored);
    if (!stored) {
      setIsAdmin(false);
      setAdminMode(null);
      return;
    }
    const r = await api<{
      isAdmin: boolean;
      adminMode: 'open' | 'restricted';
      user: { stealthMode: boolean };
    }>('/api/user/me');
    if (r.ok) {
      setIsAdmin(r.data.isAdmin);
      setAdminMode(r.data.adminMode);
      
      // Update stored user with stealthMode from backend
      if (stored.stealthMode !== r.data.user.stealthMode) {
        const updated = { ...stored, stealthMode: r.data.user.stealthMode };
        writeStoredUser(updated);
        setUser(updated);
      }
    } else if (r.status === 401) {
      // Token probably expired or invalid
      writeStoredUser(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        const stored = readStoredUser();
        const u: StoredUser = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
          token,
          stealthMode: stored?.uid === fbUser.uid ? stored.stealthMode : false,
        };
        writeStoredUser(u);
        await refresh();
      } else {
        writeStoredUser(null);
        setUser(null);
        setIsAdmin(false);
        setAdminMode(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: hydrated ? user : null,
        isAdmin,
        adminMode,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
