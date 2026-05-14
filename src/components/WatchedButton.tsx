'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type Props = {
  movieId?: number;
  episodeId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  initialWatched?: boolean;
};

export function WatchedButton({ 
  movieId, 
  episodeId, 
  seasonNumber, 
  episodeNumber,
  initialWatched 
}: Props) {
  const [watched, setWatched] = useState(initialWatched ?? false);
  const [loading, setLoading] = useState(initialWatched === undefined);

  useEffect(() => {
    if (initialWatched !== undefined) return;
    
    let active = true;
    (async () => {
      const q = movieId ? `movie_id=${movieId}` : `episode_id=${episodeId}`;
      const r = await api<{ watched: boolean }>(`/api/user/watched?${q}`);
      if (active && r.ok) {
        setWatched(r.data.watched);
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [movieId, episodeId]);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await api<{ watched: boolean }>('/api/user/watched', {
        method: 'POST',
        body: JSON.stringify({ 
          movie_id: movieId, 
          episode_id: episodeId,
          season_number: seasonNumber,
          episode_number: episodeNumber
        }),
      });
      if (r.ok) {
        setWatched(r.data.watched);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${
        watched
          ? 'bg-green-500/10 border-green-500/30 text-green-500'
          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
      } disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : watched ? (
        <CheckCircle2 size={14} />
      ) : (
        <Circle size={14} />
      )}
      {watched ? 'Watched' : 'Mark Watched'}
    </button>
  );
}
