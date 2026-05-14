'use client';
import { useEffect, useState, use } from 'react';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAlert } from '@/components/AlertModal';
import { LinksManager } from '@/components/LinksManager';
import { ChevronLeft, Loader2, Trash2 } from 'lucide-react';

type Movie = {
  id: number;
  tmdb_id: number;
  title: string;
  overview: string | null;
  poster_url: string | null;
  release_year: number | null;
};

function Inner({ tmdbId }: { tmdbId: number }) {
  const { showAlert } = useAlert();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await api<Movie>(`/api/movies/${tmdbId}`);
      if (r.ok) setMovie(r.data);
      else setErr(r.error);
    })();
  }, [tmdbId]);

  async function deleteMovie() {
    if (!movie) return;
    showAlert({
      type: 'confirm',
      message: `Delete "${movie.title}" and all its links from the catalogue?`,
      onConfirm: async () => {
        const r = await api(`/api/admin/movies/${movie.id}`, { method: 'DELETE' });
        if (r.ok) window.location.href = '/admin';
        else showAlert({ type: 'error', message: r.error || 'Failed to delete movie' });
      }
    });
  }

  if (err)
    return <div className="px-6 py-12 text-center text-brand">{err}</div>;
  if (!movie)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="animate-spin text-brand" />
      </div>
    );

  const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isFromDiscovery = sp?.get('from') === 'discovery';

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      <Link
        href={isFromDiscovery ? '/admin?source=tmdb&tab=movie' : '/admin'}
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-white transition-colors"
      >
        <ChevronLeft size={16} /> Back to {isFromDiscovery ? 'Discovery' : 'Library'}
      </Link>

      <div className="bg-surface border border-border p-4 md:p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row gap-6">
          {movie.poster_url && (
            <div className="w-32 md:w-40 mx-auto md:mx-0 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={movie.poster_url}
                alt=""
                className="w-full rounded-xl border border-border shadow-2xl"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{movie.title}</h1>
            <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-text-dim flex flex-wrap justify-center md:justify-start items-center gap-2">
              <span className="bg-white/5 px-2 py-1 rounded">Movie</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>TMDB #{movie.tmdb_id}</span>
              {movie.release_year && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>{movie.release_year}</span>
                </>
              )}
            </div>
            {movie.overview && (
              <p className="text-sm text-text-dim mt-4 line-clamp-3 md:line-clamp-none max-w-2xl leading-relaxed">
                {movie.overview}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">

              <button
                onClick={deleteMovie}
                className="flex-1 sm:flex-none text-center text-xs font-black uppercase tracking-widest border border-brand/30 text-brand hover:bg-brand hover:text-white rounded-xl px-6 py-3 inline-flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6">
        <LinksManager scope={{ kind: 'movie', movieId: movie.id }} />
      </div>
    </div>
  );
}

export default function ManageMoviePage({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}) {
  const { tmdbId } = use(params);
  return (
    <Inner tmdbId={Number(tmdbId)} />
  );
}
