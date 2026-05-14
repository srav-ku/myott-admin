'use client';
import { useState } from 'react';
import { Shield, ShieldOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

export function StealthToggle() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const isEnabled = user.stealthMode;

  async function toggle() {
    setLoading(true);
    try {
      const res = await api<{ success: boolean }>('/api/user/stealth', {
        method: 'POST',
        body: JSON.stringify({ enabled: !isEnabled }),
      });
      if (res.ok) {
        await refresh();
      }
    } catch (err) {
      console.error('Failed to update stealth mode:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[var(--color-surface-2)] transition-colors border-t border-white/5 ${
        isEnabled ? 'text-green-500' : 'text-[var(--color-text-dim)]'
      } disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isEnabled ? (
        <Shield size={14} />
      ) : (
        <ShieldOff size={14} />
      )}
      <span className="flex-1">Stealth Mode: {isEnabled ? 'ON' : 'OFF'}</span>
      <div className={`w-8 h-4 rounded-full relative transition-colors ${isEnabled ? 'bg-green-500/50' : 'bg-white/10'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isEnabled ? 'right-0.5' : 'left-0.5'}`} />
      </div>
    </button>
  );
}
