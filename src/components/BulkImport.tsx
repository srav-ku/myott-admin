'use client';

import { useState } from 'react';
import { useAlert } from './AlertModal';
import { api } from '@/lib/api';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, XCircle, Film, Tv } from 'lucide-react';

type ImportResult = {
  success: boolean;
  added?: number;
  added_episodes?: number;
  added_links?: number;
  skipped: number;
  failed: number;
  errors: { row: number; reason: string }[];
};

export default function BulkImport() {
  const [movieFile, setMovieFile] = useState<File | null>(null);
  const [tvFile, setTvFile] = useState<File | null>(null);
  const [tvTmdbId, setTvTmdbId] = useState('');
  const [loading, setLoading] = useState<'movie' | 'tv' | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { showAlert } = useAlert();

  async function handleImport(type: 'movie' | 'tv') {
    const file = type === 'movie' ? movieFile : tvFile;
    if (!file) return;

    if (type === 'tv' && !tvTmdbId) {
      showAlert({ type: 'error', message: 'Please enter a TV TMDB ID' });
      return;
    }

    setLoading(type);
    setResult(null);

    try {
      const text = await file.text();
      const endpoint = type === 'movie' 
        ? '/api/admin/import/movie' 
        : `/api/admin/import/tv?tv_tmdb_id=${tvTmdbId}`;
      
      const r = await api<ImportResult>(endpoint, {
        method: 'POST',
        body: text,
      });

      if (r.ok) {
        setResult(r.data);
      } else {
        showAlert({ type: 'error', message: r.error || 'Import failed' });
      }
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', message: 'An error occurred during import' });
    } finally {
      setLoading(null);
    }
  }

  function downloadSample(type: 'movie' | 'tv') {
    const headers = type === 'movie'
      ? 'tmdb_id,title,stream_url,quality,languages,type'
      : 'season_number,episode_number,title,stream_url,quality,languages,type';
    
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_import_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-surface border border-border rounded-3xl overflow-hidden">
      <div className="px-8 py-6 border-b border-border bg-white/2">
        <h2 className="text-xl font-bold tracking-tight">Bulk Content Import</h2>
      </div>

      <div className="p-8 grid md:grid-cols-2 gap-0">
        {/* Movie Import */}
        <div className="flex flex-col h-full p-6 md:p-8 md:pr-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Film size={18} className="text-brand" />
              <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-text-dim">
                Movies (CSV)
              </h3>
            </div>
            <button
              onClick={() => downloadSample('movie')}
              className="text-[10px] font-black uppercase tracking-widest text-brand hover:text-brand-hover flex items-center gap-2 transition-colors self-start sm:self-auto"
            >
              <Download size={14} />
              Sample
            </button>
          </div>
          
          <div className="flex-1 flex flex-col gap-6">
            <div className="relative group flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setMovieFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all ${movieFile ? 'border-brand/40 bg-brand/5' : 'border-border group-hover:border-white/20 group-hover:bg-white/5'}`}>
                <Upload size={24} className={movieFile ? 'text-brand' : 'text-text-dim'} />
                <div className="text-center px-4">
                  <div className="text-xs font-bold text-white truncate max-w-[240px]">
                    {movieFile ? movieFile.name : 'Click to select CSV'}
                  </div>
                  {!movieFile && <div className="text-[10px] text-text-dim uppercase tracking-widest mt-1">or drag and drop</div>}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleImport('movie')}
              disabled={!movieFile || !!loading}
              className="w-full py-4 bg-brand text-white font-black rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all uppercase tracking-[0.2em] text-[10px]"
            >
              {loading === 'movie' ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Import Movies
            </button>
          </div>
        </div>

        {/* TV Import */}
        <div className="flex flex-col h-full p-6 md:p-8 md:pl-12 border-t border-border md:border-t-0 md:border-l">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Tv size={18} className="text-brand" />
              <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-text-dim">
                TV Episodes (CSV)
              </h3>
            </div>
            <button
              onClick={() => downloadSample('tv')}
              className="text-[10px] font-black uppercase tracking-widest text-brand hover:text-brand-hover flex items-center gap-2 transition-colors self-start sm:self-auto"
            >
              <Download size={14} />
              Sample
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-6">
            <div className="relative">
              <label className="absolute -top-2 left-4 px-2 bg-surface text-[9px] font-black uppercase tracking-widest text-text-dim z-10">
                Series TMDB ID
              </label>
              <input
                type="number"
                placeholder="Enter TMDB ID"
                value={tvTmdbId}
                onChange={(e) => setTvTmdbId(e.target.value)}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-brand/50 transition-all placeholder:text-text-dim/20"
              />
            </div>

            <div className="relative group">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setTvFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 transition-all ${tvFile ? 'border-brand/40 bg-brand/5' : 'border-border group-hover:border-white/20 group-hover:bg-white/5'}`}>
                <Upload size={24} className={tvFile ? 'text-brand' : 'text-text-dim'} />
                <div className="text-center px-4">
                  <div className="text-xs font-bold text-white truncate max-w-[240px]">
                    {tvFile ? tvFile.name : 'Click to select CSV'}
                  </div>
                  {!tvFile && <div className="text-[10px] text-text-dim uppercase tracking-widest mt-1">or drag and drop</div>}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleImport('tv')}
              disabled={!tvFile || !tvTmdbId || !!loading}
              className="w-full py-4 bg-brand text-white font-black rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all uppercase tracking-[0.2em] text-[10px]"
            >
              {loading === 'tv' ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Import Episodes
            </button>
          </div>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="bg-black/40 border-t border-border p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-wrap gap-8 items-center mb-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">Status</span>
              <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-4 py-2 rounded-xl text-xs font-black border border-green-500/20">
                <CheckCircle2 size={16} />
                {result.added_links !== undefined 
                  ? `${result.added_links} Links Added` 
                  : `${result.added ?? 0} Titles Added`}
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">Skipped</span>
              <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-xl text-xs font-black border border-yellow-500/20">
                <AlertCircle size={16} />
                {result.skipped}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">Failed</span>
              <div className="flex items-center gap-2 bg-brand/10 text-brand px-4 py-2 rounded-xl text-xs font-black border border-brand/20">
                <XCircle size={16} />
                {result.failed}
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-brand/5 rounded-2xl border border-brand/10 overflow-hidden">
              <div className="bg-brand/10 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand border-b border-brand/10">
                Error Log
              </div>
              <div className="max-h-48 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="text-xs text-brand/70 flex gap-4 items-start">
                    <span className="font-black text-brand bg-brand/10 px-3 py-1 rounded text-[9px] mt-0.5">ROW {err.row}</span>
                    <span className="font-bold leading-relaxed">{err.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
