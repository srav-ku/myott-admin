'use client';
import { Suspense, useEffect, useState } from 'react';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAlert } from '@/components/AlertModal';
import { Search, Loader2, ArrowRight, Tv, Film } from 'lucide-react';
import BulkImport from '@/components/BulkImport';

type Result = {
  id: number;
  tmdb_id: number;
  local_id?: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  in_db: boolean;
};

type Stats = {
  moviesWithoutLinks: number;
  tvMissingEpisodes: number;
};

function ContentDashboard() {
  const { showAlert } = useAlert();
  const sp = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<'movie' | 'tv'>(
    (sp.get('tab') as 'tv') === 'tv' ? 'tv' : 'movie',
  );
  const source = sp.get('source') === 'tmdb' ? 'tmdb' : 'local';
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  async function loadStats() {
    const r = await api<{ stats: Stats }>('/api/admin/stats');
    if (r.ok) setStats(r.data.stats);
  }

  async function loadDefault() {
    setLoading(true);
    const ep =
      tab === 'movie'
        ? `/api/movies?source=${source}&limit=24`
        : `/api/tv?source=${source}&limit=24`;
    const r = await api<{ results: Result[] }>(ep);
    setLoading(false);
    if (r.ok) {
      setResults(r.data.results.map((x) => ({ ...x, media_type: tab })));
    }
  }

  async function search() {
    const query = q.trim();
    if (!query) {
      void loadDefault();
      return;
    }
    setLoading(true);

    try {
      // FORCE local Next.js API for the admin dashboard
      // by using a relative path without the api helper's baseUrl logic
      const res = await api<any>(`/api/search?q=${encodeURIComponent(query)}&type=${tab}&limit=40`);
      
      if (res.ok) {
        const body = res.data;
        if (source === 'local') {
          setResults(body.results.filter((x: any) => x.in_db));
        } else {
          setResults(body.results);
        }
      } else {
        console.error('Search API failed:', res.error);
      }
    } catch (e) {
      console.error('Search exception:', e);
    } finally {
      setLoading(false);
    }
  }

  async function addToLibrary(tmdbId: number, kind: 'movie' | 'tv') {
    const r = await api(`/api/${kind === 'movie' ? 'movies' : 'tv'}/${tmdbId}`);
    if (r.ok) {
      showAlert({ type: 'success', message: 'Successfully added to Library!' });
      // Update UI to show it's in DB now
      setResults(prev => prev.map(item => item.tmdb_id === tmdbId ? { ...item, in_db: true } : item));
    } else {
      showAlert({ type: 'error', message: r.error || 'Failed to add to library' });
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    if (q.trim()) {
      void search();
    } else if (source === 'local') {
      void loadDefault();
    } else {
      setResults([]);
    }
  }, [tab, source]);

  async function addAndManage(tmdbId: number, kind: 'movie' | 'tv') {
    setLoading(true);
    try {
      const r = await api(`/api/${kind === 'movie' ? 'movies' : 'tv'}/${tmdbId}`);
      if (r.ok) {
        // Clear loading before pushing to allow immediate feedback
        setLoading(false);
        const fromParam = source === 'tmdb' ? '?from=discovery' : '';
        router.push(`/admin/manage/${kind}/${tmdbId}${fromParam}`);
      } else {
        showAlert({ type: 'error', message: r.error || 'Failed to add to library' });
        setLoading(false);
      }
    } catch (err) {
      console.error('Quick Add Error:', err);
      showAlert({ type: 'error', message: 'An unexpected error occurred. Please try again.' });
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto">
      {/* Header Row: Tabs & Search */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch lg:items-center justify-between bg-surface border border-border p-4 md:p-6 rounded-2xl">
        <div className="inline-flex rounded-xl bg-bg border border-border p-1.5 self-start">
          {(['movie', 'tv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 md:px-6 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                tab === t
                  ? 'bg-brand text-white'
                  : 'text-text-dim hover:text-white'
              }`}
            >
              {t === 'movie' ? 'Movies' : 'TV Series'}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
          className="w-full lg:max-w-md relative group"
        >
          <button
            type="submit"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-text-dim group-focus-within:text-brand hover:text-brand transition-colors"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search by name, TMDB ID or URL…`}
            className="w-full bg-bg border border-border rounded-xl pl-11 pr-24 md:pr-32 py-3 text-sm font-medium outline-none focus:border-brand/50 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 md:px-4 py-1.5 bg-brand text-white text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg hover:bg-brand/90 transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {/* Results Section (Scrollable) */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col min-h-[400px] lg:max-h-[700px]">
        <div className="px-4 md:px-6 py-4 border-b border-border bg-white/2 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            {source === 'local' ? 'Library Content' : 'Search Results'}
          </span>
          {loading && <Loader2 className="animate-spin text-brand" size={16} />}
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar">
          {!loading && results.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-text-dim gap-3 opacity-50 py-20">
              <Search size={40} strokeWidth={1} />
              <p className="text-sm font-medium text-center px-4">
                {source === 'local' ? 'Your library is empty' : 'Search for something to discover'}
              </p>
            </div>
          )}

          <div className="grid gap-2 md:gap-3">
            {results.map((r, idx) => {
              const k = r.media_type || tab;
              const title = r.title || r.name || '(untitled)';
              const inDb = r.in_db || source === 'local';
              const poster = r.poster_url;
              
              return (
                <div
                  key={`${k}-${r.tmdb_id || idx}`}
                  className="group flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 bg-bg/50 border border-border rounded-xl p-3 hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-14 md:w-12 md:h-16 shrink-0 rounded-lg overflow-hidden bg-bg">
                      {poster ? (
                        <img src={poster} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Film size={20} className="text-text-dim" /></div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-bold text-sm truncate max-w-[200px] sm:max-w-none">{title}</div>
                        {inDb && source === 'tmdb' && (
                          <span className="text-[7px] md:text-[8px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 uppercase font-black tracking-wider">
                            In Library
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] md:text-[10px] text-text-dim uppercase tracking-widest font-bold mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{k === 'movie' ? 'Movie' : 'TV Series'}</span>
                        <span className="hidden xs:block w-1 h-1 rounded-full bg-white/10" />
                        <span className="hidden xs:block">TMDB #{r.id}</span>
                        {(r.release_date || r.first_air_date) && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span>{(r.release_date || r.first_air_date)?.slice(0, 4)}</span>
                          </>
                        )}
                        {r.vote_average && r.vote_average > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span className="text-yellow-500/80">★ {r.vote_average.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                    {inDb ? (
                      <Link
                        href={k === 'movie' ? `/admin/manage/movie/${r.tmdb_id}${source === 'tmdb' ? '?from=discovery' : ''}` : `/admin/manage/tv/${r.tmdb_id}${source === 'tmdb' ? '?from=discovery' : ''}`}
                        className="flex-1 sm:flex-none text-center px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                      >
                        Manage
                      </Link>
                    ) : (
                      <button
                        onClick={() => void addAndManage(r.tmdb_id, k as any)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                      >
                        Add & Manage
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bulk Import (Lower Priority) */}
      {source === 'tmdb' && (
        <div className="opacity-80 hover:opacity-100 transition-opacity pb-8">
          <BulkImport />
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-text-dim"><Loader2 className="animate-spin" size={16} /> Loading content...</div>}>
      <ContentDashboard />
    </Suspense>
  );
}
