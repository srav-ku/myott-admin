'use client';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { X, Globe } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setErr(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (e: any) {
      console.error('Sign in failed:', e);
      setErr(e.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface border border-border p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Welcome</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
        <p className="text-text-dim mb-8">
          Sign in to sync your watchlist and history across devices.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-semibold text-black hover:bg-gray-200 disabled:opacity-50 transition-all shadow-md"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                fill="#EA4335"
              />
            </svg>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </button>

          <button
            onClick={onClose}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border px-4 py-3 font-semibold text-white hover:bg-white/5 transition-all"
          >
            <Globe size={20} className="text-text-dim" />
            Continue as Guest
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-md bg-brand/10 border border-brand/20 p-3 text-sm text-brand">
            {err}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-text-dim uppercase tracking-widest">
          Secured by Firebase
        </div>
      </div>
    </div>
  );
}
