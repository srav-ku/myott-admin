'use client';
import { useState, useEffect } from 'react';
import { X, Loader2, Play } from 'lucide-react';
import { api } from '@/lib/api';

export function RewardAdModal({ 
  adId,
  onComplete, 
  onClose 
}: { 
  adId?: number;
  onComplete: () => void; 
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15); // 15 seconds for custom rewarded ad

  useEffect(() => {
    // Log impression
    void api('/api/ads/event', {
      method: 'POST',
      body: JSON.stringify({ adId, type: 'impression' }),
    });

    // Simulate ad loading
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, [adId]);

  async function handleComplete() {
    // Log reward completed
    await api('/api/ads/event', {
      method: 'POST',
      body: JSON.stringify({ adId, type: 'reward_completed' }),
    });
    onComplete();
  }

  useEffect(() => {
    if (loading) return;
    if (timeLeft <= 0) {
      handleComplete();
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [loading, timeLeft]);

  return (
    <div className="fixed inset-0 z-100 grid place-items-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Ambient background effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-4 relative z-10">
            <Loader2 className="animate-spin text-brand" size={40} />
            <p className="text-sm font-medium text-white">Loading advertisement...</p>
          </div>
        ) : (
          <div className="relative z-10 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Watch ad to continue</h3>
              <p className="text-sm text-text-dim">Your content will start automatically in {timeLeft} seconds.</p>
            </div>
            
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden relative border border-white/5 flex items-center justify-center group">
               <div className="absolute inset-0 bg-linear-to-br from-brand/20 to-transparent opacity-50" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 transition-transform duration-500">
                    <Play size={32} className="text-brand fill-brand ml-1" />
                  </div>
               </div>
               <div className="absolute bottom-4 left-4 flex items-center gap-2">
                 <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/40 bg-black/40 px-2 py-0.5 rounded border border-white/5 backdrop-blur-md">
                   Sponsored Video
                 </span>
               </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={onClose}
                className="text-xs text-text-dim hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white"
              >
                Cancel and return
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
