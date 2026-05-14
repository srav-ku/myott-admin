'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAlert } from '@/components/AlertModal';
import { LinksManager } from '@/components/LinksManager';
import {
  ChevronLeft,
  Loader2,
  Trash2,
  Plus,
  X
} from 'lucide-react';

type Tv = {
  id: number;
  tmdb_id: number;
  name: string;
  overview: string | null;
  poster_url: string | null;
  first_air_date: string | null;
  release_year: number | null;
};

type EpisodeLink = {
  id?: number;
  quality: string;
  url: string;
  type: 'direct' | 'extract';
  languages: string[] | null;
};

type Episode = {
  id: number;
  tvId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  overview: string | null;
  links?: EpisodeLink[];
};

function Inner({ tmdbId }: { tmdbId: number }) {
  const { showAlert } = useAlert();
  const [show, setShow] = useState<Tv | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);

  const [addingEpisode, setAddingEpisode] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [newEpSeason, setNewEpSeason] = useState(1);
  const [newEpNum, setNewEpNum] = useState(1);
  const [addingBusy, setAddingBusy] = useState(false);

  async function handleAddEpisode(e: React.FormEvent) {
    e.preventDefault();
    setAddingBusy(true);
    const r = await api(`/api/admin/tv/${show!.id}/episodes`, {
      method: 'POST',
      body: JSON.stringify({ season_number: newEpSeason, episode_number: newEpNum })
    });
    setAddingBusy(false);
    if (r.ok) {
      setAddingEpisode(false);
      void loadEpisodes(show!.id);
      setActiveSeason(newEpSeason);
    } else {
      showAlert({ type: 'error', message: r.error || 'Failed to add episode' });
    }
  }

  async function loadEpisodes(tvId: number) {
    const r = await api<{ episodes: Episode[] }>(`/api/admin/tv/${tvId}/episodes`);
    if (r.ok) {
      const sorted = [...r.data.episodes].sort(
        (a, b) =>
          a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber,
      );
      setEpisodes(sorted);
      if (activeSeason === null && sorted.length > 0) {
        setActiveSeason(sorted[0].seasonNumber);
      }
    }
  }

  useEffect(() => {
    (async () => {
      const r = await api<Tv>(`/api/tv/${tmdbId}`);
      if (r.ok) {
        setShow(r.data);
        void loadEpisodes(r.data.id);
      } else setErr(r.error);
    })();
  }, [tmdbId]);

  async function deleteShow() {
    if (!show) return;
    showAlert({
      type: 'confirm',
      message: `Delete "${show.name}" with all episodes & links?`,
      onConfirm: async () => {
        const r = await api(`/api/admin/tv/${show.id}`, { method: 'DELETE' });
        if (r.ok) window.location.href = '/admin';
        else showAlert({ type: 'error', message: r.error || 'Failed to delete series' });
      }
    });
  }

  if (err)
    return <div className="px-6 py-12 text-center text-brand">{err}</div>;
  if (!show)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="animate-spin" />
      </div>
    );

  const seasons = episodes
    ? Array.from(new Set(episodes.map((e) => e.seasonNumber))).sort((a, b) => a - b)
    : [];
  const year =
    show.release_year ?? (Number(show.first_air_date?.slice(0, 4)) || null);

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-white transition-colors"
      >
        <ChevronLeft size={16} /> Back to Library
      </Link>

      <div className="bg-surface border border-border p-4 md:p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row gap-6">
          {show.poster_url && (
            <div className="w-32 md:w-40 mx-auto md:mx-0 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={show.poster_url}
                alt=""
                className="w-full rounded-xl border border-border shadow-2xl"
              />
            </div>
          )}
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{show.name}</h1>
            <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-text-dim flex flex-wrap justify-center md:justify-start items-center gap-2">
              <span className="bg-white/5 px-2 py-1 rounded">TV Series</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>TMDB #{show.tmdb_id}</span>
              {year && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>{year}</span>
                </>
              )}
            </div>
            {show.overview && (
              <p className="text-sm text-text-dim mt-4 line-clamp-3 md:line-clamp-none max-w-2xl leading-relaxed">
                {show.overview}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-3">

              <button
                onClick={deleteShow}
                className="flex-1 sm:flex-none text-center text-xs font-black uppercase tracking-widest border border-brand/30 text-brand hover:bg-brand hover:text-white rounded-xl px-6 py-3 inline-flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 size={14} className="hidden xs:block" /> Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/50 p-4 rounded-xl border border-border">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSeason(s)}
                className={`px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeSeason === s
                    ? 'bg-brand text-white'
                    : 'bg-bg border border-border text-text-dim hover:text-white'
                }`}
              >
                Season {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAddingEpisode(false);
                setBulkAdding(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border border-brand/30 text-brand px-4 py-2.5 rounded-lg hover:bg-brand/10 transition-all bg-brand/5"
            >
              <Plus size={14} /> Bulk Links
            </button>
            <button
              onClick={() => {
                setBulkAdding(false);
                setNewEpSeason(activeSeason || 1);
                setAddingEpisode(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-brand text-white px-4 py-2.5 rounded-lg hover:bg-brand/90 transition-all"
            >
              <Plus size={14} /> Add Episode
            </button>
          </div>
        </div>

        {addingEpisode && (
          <form onSubmit={handleAddEpisode} className="bg-surface-2 border border-border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Episode Manually</h3>
              <button type="button" onClick={() => setAddingEpisode(false)} className="text-text-dim hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <label className="block flex-1">
                <span className="text-[10px] uppercase tracking-wider text-text-dim">Season</span>
                <input type="number" min={0} value={newEpSeason} onChange={(e) => setNewEpSeason(Number(e.target.value))} className="w-full mt-1 bg-bg border border-border rounded px-3 py-2 text-sm" required />
              </label>
              <label className="block flex-1">
                <span className="text-[10px] uppercase tracking-wider text-text-dim">Episode</span>
                <input type="number" min={0} value={newEpNum} onChange={(e) => setNewEpNum(Number(e.target.value))} className="w-full mt-1 bg-bg border border-border rounded px-3 py-2 text-sm" required />
              </label>
            </div>
            <div className="flex justify-end">
              <button disabled={addingBusy} type="submit" className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                {addingBusy && <Loader2 size={14} className="animate-spin" />}
                Save Episode
              </button>
            </div>
          </form>
        )}

        {bulkAdding && activeSeason !== null && episodes && (
          <BulkLinksForm
            seasonNumber={activeSeason}
            episodes={episodes.filter(e => e.seasonNumber === activeSeason)}
            onSuccess={() => {
              setBulkAdding(false);
              void loadEpisodes(show.id);
            }}
            onCancel={() => setBulkAdding(false)}
          />
        )}

        <div className="space-y-4">
          {!episodes ? (
            <Loader2 className="animate-spin" />
          ) : episodes.length === 0 ? (
            <div className="text-sm text-text-dim border border-dashed border-border rounded p-12 text-center">
              No episodes found for this show.
            </div>
          ) : (
            episodes
              .filter((e) => e.seasonNumber === activeSeason)
              .map((e) => <EpisodeAdminCard key={e.id} episode={e} />)
          )}
        </div>
      </div>
    </div>
  );
}
function EpisodeAdminCard({ episode }: { episode: Episode }) {
  const { showAlert } = useAlert();
  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden transition-all hover:border-white/10 group">
      <div className="p-4 border-b border-border bg-white/2 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 text-[10px] font-black text-brand bg-brand/10 px-2 py-1 rounded-lg border border-brand/20 uppercase tracking-widest">
            EP {episode.episodeNumber}
          </span>
          <span className="font-bold text-sm truncate text-white/90 group-hover:text-white transition-colors">
            {episode.title || `Episode ${episode.episodeNumber}`}
          </span>
        </div>
        <button
          onClick={() => {
            showAlert({
              type: 'confirm',
              message: 'Delete this episode?',
              onConfirm: () => {
                api(`/api/admin/tv/${episode.tvId}/episodes/${episode.id}`, {
                  method: 'DELETE',
                }).then(() => window.location.reload());
              }
            });
          }}
          className="shrink-0 text-text-dim hover:text-brand p-2 transition-all hover:bg-brand/10 rounded-lg"
          title="Delete Episode"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="p-4 md:p-6">
        <LinksManager scope={{ kind: 'episode', episodeId: episode.id }} />
      </div>
    </div>
  );
}

function BulkLinksForm({
  seasonNumber,
  episodes,
  onSuccess,
  onCancel,
}: {
  seasonNumber: number;
  episodes: Episode[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { showAlert } = useAlert();
  const [quality, setQuality] = useState('1080p');
  const [type, setType] = useState<'direct' | 'extract'>('direct');
  const [urlsText, setUrlsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [langs, setLangs] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);

  useEffect(() => {
    api<{ languages: string[] }>('/api/admin/languages').then(r => {
      if (r.ok) setLangs(r.data.languages);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lines = urlsText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    
    setBusy(true);
    let successCount = 0;
    
    // Sort episodes ascending
    const sorted = [...episodes].sort((a,b) => a.episodeNumber - b.episodeNumber);

    for (let i = 0; i < Math.min(lines.length, sorted.length); i++) {
      const ep = sorted[i];
      const url = lines[i];
      
      await api('/api/admin/links', {
        method: 'POST',
        body: JSON.stringify({
          episode_id: ep.id,
          quality,
          type,
          url,
          languages: selectedLangs
        })
      });
      successCount++;
    }
    
    setBusy(false);
    showAlert({ type: 'success', message: `Successfully added ${successCount} links to Season ${seasonNumber}!` });
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="bg-surface border border-brand/40 rounded-2xl p-4 md:p-6 space-y-5 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div className="min-w-0">
          <h3 className="font-black text-brand uppercase tracking-widest text-xs">Bulk Add Links — Season {seasonNumber}</h3>
          <p className="text-[10px] text-text-dim mt-1 leading-relaxed">Paste URLs (one per line). Order matches episode numbers.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-text-dim hover:text-white p-1">
          <X size={20} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim mb-1.5 block">Quality</span>
          <select value={quality} onChange={e => setQuality(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand/50 transition-all cursor-pointer">
            {['1080p', '720p', '480p', '4K'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim mb-1.5 block">Type</span>
          <select value={type} onChange={e => setType(e.target.value as 'direct'|'extract')} className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand/50 transition-all cursor-pointer">
            <option value="direct">Direct (.mp4 / .m3u8)</option>
            <option value="extract">Extract (worker)</option>
          </select>
        </label>
      </div>

      <div className="block">
        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim mb-2 block">Languages</span>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar p-1">
          {langs.map(l => (
            <label key={l} className={`flex items-center gap-2 text-xs border rounded-lg px-3 py-1.5 cursor-pointer transition-all ${
              selectedLangs.includes(l) ? 'bg-brand/20 border-brand text-white' : 'bg-bg border-border text-text-dim hover:border-white/20'
            }`}>
              <input 
                type="checkbox" 
                className="hidden"
                checked={selectedLangs.includes(l)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedLangs([...selectedLangs, l]);
                  else setSelectedLangs(selectedLangs.filter(x => x !== l));
                }}
              />
              {l}
            </label>
          ))}
          {langs.length === 0 && <span className="text-[10px] text-text-dim italic">No languages found.</span>}
        </div>
      </div>

      <label className="block">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">URLs (One per line)</span>
          <div className="text-[10px] font-bold text-brand bg-brand/5 px-2 py-0.5 rounded border border-brand/10">
            {urlsText.split('\n').filter(l => l.trim()).length} / {episodes.length} EPISODES
          </div>
        </div>
        <textarea 
          value={urlsText} 
          onChange={e => setUrlsText(e.target.value)} 
          required
          rows={6}
          placeholder={`https://example.com/s01e01.mp4\nhttps://example.com/s01e02.mp4`}
          className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-mono whitespace-pre outline-none focus:border-brand/50 transition-all" 
        />
      </label>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-border hover:bg-white/5 transition-all order-2 sm:order-1">
          Cancel
        </button>
        <button disabled={busy} type="submit" className="w-full sm:w-auto bg-brand text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all order-1 sm:order-2">
          {busy && <Loader2 size={14} className="animate-spin" />}
          Add Bulk Links
        </button>
      </div>
    </form>
  );
}

export default function ManageTvPage({
  params,
}: {
  params: Promise<{ tmdbId: string }>;
}) {
  const { tmdbId } = use(params);
  return (
    <Inner tmdbId={Number(tmdbId)} />
  );
}
