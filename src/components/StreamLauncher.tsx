'use client';
import { useRouter } from 'next/navigation';
import { Play, Copy, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

type Link = {
  id: number;
  quality: string;
  type: 'direct' | 'extract';
  languages: string[] | null;
};

type Props = {
  links: Link[];
  watchHrefBase: string; // e.g. '/watch/movie/27205' or '/watch/episode/123'
  contentId: number;     // internal db id
  contentType: 'movie' | 'episode';
};

const QUALITY_ORDER = ['1080p', '720p'];

export function StreamLauncher({ links, watchHrefBase, contentId, contentType }: Props) {
  const router = useRouter();
  const [showCopyLink, setShowCopyLink] = useState(false);
  const [copying, setCopying] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    const check = () => setShowCopyLink(localStorage.getItem('showCopyLink') === 'true');
    check();
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  if (links.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-dim)]">
        No streams available yet. An admin needs to add a link.
      </div>
    );
  }

  const sorted = [...links].sort(
    (a, b) => QUALITY_ORDER.indexOf(a.quality) - QUALITY_ORDER.indexOf(b.quality),
  );
  const best = sorted[0];

  async function recordHistory(linkId: number) {
    const body = contentType === 'movie' 
      ? { movie_id: contentId }
      : { episode_id: contentId };
    
    await api('/api/user/history', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async function handleWatch(linkId: number) {
    await recordHistory(linkId);
    router.push(`${watchHrefBase}?link=${linkId}`);
  }

  async function handleCopy(linkId: number) {
    setCopying(linkId);
    try {
      const res = await api<{ url: string }>(`/api/stream/${linkId}`);
      if (res.ok && res.data.url) {
        await navigator.clipboard.writeText(res.data.url);
        setCopied(linkId);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
    } finally {
      setCopying(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleWatch(best.id)}
          className="inline-flex items-center gap-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-bold uppercase tracking-wider text-xs rounded-lg px-6 py-3 transition-all shadow-lg"
        >
          <Play size={16} fill="white" /> Play {best.quality}
        </button>

        {showCopyLink && (
          <button
            onClick={() => handleCopy(best.id)}
            disabled={!!copying}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider text-xs rounded-lg px-6 py-3 transition-all border border-white/10"
          >
            {copying === best.id ? (
              <Loader2 size={16} className="animate-spin" />
            ) : copied === best.id ? (
              <Check size={16} className="text-green-500" />
            ) : (
              <Copy size={16} />
            )}
            {copied === best.id ? 'Copied!' : `Copy ${best.quality} Link`}
          </button>
        )}
      </div>

      {sorted.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-dim)]">
            Other Qualities:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sorted.slice(1).map((l) => (
              <div key={l.id} className="flex items-center gap-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-1">
                <button
                  onClick={() => handleWatch(l.id)}
                  className="text-[10px] font-bold px-2 py-1 hover:text-[var(--color-brand)] transition-colors"
                >
                  {l.quality}
                </button>
                {showCopyLink && (
                  <button
                    onClick={() => handleCopy(l.id)}
                    className="p-1 hover:text-[var(--color-brand)] transition-colors border-l border-[var(--color-border)]"
                    title="Copy Link"
                  >
                    {copying === l.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : copied === l.id ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
