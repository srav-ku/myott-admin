'use client';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { ShieldAlert, Loader2 } from 'lucide-react';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, isAdmin, adminMode } = useAuth();

  if (!user) {
    return (
      <div className="px-6 py-16 text-center">
        <ShieldAlert className="mx-auto text-[var(--color-brand)] mb-3" size={40} />
        <h2 className="text-xl font-semibold mb-1">Sign in required</h2>
        <p className="text-[var(--color-text-dim)]">
          Sign in with the email above to access admin tools.
        </p>
      </div>
    );
  }
  if (adminMode === null) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="px-6 py-16 text-center">
        <ShieldAlert className="mx-auto text-[var(--color-brand)] mb-3" size={40} />
        <h2 className="text-xl font-semibold mb-1">Forbidden</h2>
        <p className="text-[var(--color-text-dim)]">
          Your email isn&apos;t in the admin allowlist.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
