'use client';
import { useEffect, useState } from 'react';
import { useAlert } from './AlertModal';
import { QUALITIES, type Quality } from '@/lib/quality';
import { api } from '@/lib/api';
import { Plus, Trash2, Loader2, Save, X, AlertCircle, Edit2 } from 'lucide-react';

type LinkRow = {
  id: number;
  movieId: number | null;
  episodeId: number | null;
  quality: Quality;
  type: 'direct' | 'extract';
  url: string;
  extractedUrl: string | null;
  expiresAt: number | null;
  languages: string[] | null;
};

export function LinksManager({
  scope,
}: {
  scope: { kind: 'movie'; movieId: number } | { kind: 'episode'; episodeId: number };
}) {
  const [items, setItems] = useState<LinkRow[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [addingLanguage, setAddingLanguage] = useState(false);

  const queryKey =
    scope.kind === 'movie' ? `movie_id=${scope.movieId}` : `episode_id=${scope.episodeId}`;

  async function loadLinks() {
    setError(null);
    const r = await api<{ links: LinkRow[] }>(`/api/admin/links?${queryKey}`);
    if (r.ok) setItems(r.data.links);
    else setError(r.error);
  }

  async function loadLanguages() {
    const r = await api<{ languages: string[] }>('/api/admin/languages');
    if (r.ok) setAvailableLanguages(r.data.languages);
    else console.error('Failed to load languages:', r.error);
  }

  useEffect(() => {
    setItems(null);
    void loadLinks();
    void loadLanguages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  async function addLink(form: NewLink) {
    setSaving(true);
    setError(null);
    const body =
      scope.kind === 'movie'
        ? { movie_id: scope.movieId, ...form }
        : { episode_id: scope.episodeId, ...form };
    const r = await api('/api/admin/links', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (r.ok) {
      setShowAdd(false);
      void loadLinks();
    } else {
      setError(r.error);
    }
  }

  async function addNewLanguage(name: string) {
    setAddingLanguage(true);
    const r = await api('/api/admin/languages', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    setAddingLanguage(false);
    if (r.ok) {
      void loadLanguages(); // Reload languages to include the new one
    } else {
      setError(r.error);
    }
  }

  const { showAlert } = useAlert();

  async function remove(id: number) {
    showAlert({
      type: 'confirm',
      message: 'Delete this link?',
      onConfirm: async () => {
        await api(`/api/admin/links/${id}`, { method: 'DELETE' });
        void loadLinks();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-text-dim">Streaming Links</h3>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className={`inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-lg px-4 py-2 transition-all ${
            showAdd ? 'bg-white/5 text-white' : 'bg-brand text-white'
          }`}
        >
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {showAdd && (
        <NewLinkForm
          onSave={addLink}
          saving={saving}
          availableLanguages={availableLanguages}
          onAddNewLanguage={addNewLanguage}
          addingLanguage={addingLanguage}
        />
      )}

      {error && (
        <div className="text-xs text-brand bg-brand/10 border border-brand/20 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!items ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-brand" size={24} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-text-dim border border-dashed border-border rounded-xl p-8 text-center bg-white/2 italic">
          No links yet. Click &quot;Add Link&quot; above to start.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((l) => (
            <LinkItem
              key={l.id}
              link={l}
              availableLanguages={availableLanguages}
              onChanged={loadLinks}
              onDelete={() => remove(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type NewLink = {
  quality: Quality;
  type: 'direct' | 'extract';
  url: string;
  languages: string[];
};

function NewLinkForm({
  onSave,
  saving,
  availableLanguages,
  onAddNewLanguage,
  addingLanguage,
}: {
  onSave: (f: NewLink) => void;
  saving: boolean;
  availableLanguages: string[];
  onAddNewLanguage: (name: string) => void;
  addingLanguage: boolean;
}) {
  const [quality, setQuality] = useState<Quality>('1080p');
  const [type, setType] = useState<'direct' | 'extract'>('direct');
  const [url, setUrl] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [newLanguageName, setNewLanguageName] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onSave({
      quality,
      type,
      url: url.trim(),
      languages: selectedLanguages,
    });
  }

  function handleLanguageChange(lang: string, isChecked: boolean) {
    setSelectedLanguages((prev) => (isChecked ? [...prev, lang] : prev.filter((l) => l !== lang)));
  }

  function handleAddLanguage(e: React.FormEvent) {
    e.preventDefault();
    if (newLanguageName.trim() && !availableLanguages.includes(newLanguageName.trim())) {
      onAddNewLanguage(newLanguageName.trim());
      setNewLanguageName('');
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-bg/50 border border-brand/20 rounded-2xl p-4 md:p-6 space-y-4 animate-in fade-in slide-in-from-top-2"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Quality">
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as Quality)}
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-all"
          >
            {QUALITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'direct' | 'extract')}
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand/50 transition-all"
          >
            <option value="direct">Direct</option>
            <option value="extract">Extract</option>
          </select>
        </Field>
      </div>

      <Field label="Languages">
        <div className="flex flex-wrap gap-2 py-1">
          {availableLanguages.map((lang) => (
            <label key={lang} className={`flex items-center gap-2 text-[10px] font-bold border rounded-lg px-3 py-1.5 cursor-pointer transition-all ${
              selectedLanguages.includes(lang) ? 'bg-brand/10 border-brand/40 text-white' : 'bg-bg border-border text-text-dim hover:border-white/20'
            }`}>
              <input
                type="checkbox"
                checked={selectedLanguages.includes(lang)}
                onChange={(e) => handleLanguageChange(lang, e.target.checked)}
                className="hidden"
              />
              {lang}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            value={newLanguageName}
            onChange={(e) => setNewLanguageName(e.target.value)}
            placeholder="New language..."
            className="flex-1 bg-bg border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand/50 transition-all"
          />
          <button
            type="button"
            onClick={handleAddLanguage}
            disabled={addingLanguage || !newLanguageName.trim()}
            className="bg-white/5 hover:bg-white/10 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50"
          >
            {addingLanguage ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
      </Field>

      <Field label="Stream URL">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          required
          className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand/50 transition-all"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand text-white text-xs font-black uppercase tracking-widest rounded-xl px-8 py-3 transition-all"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Link
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-text-dim mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function LinkItem({
  link,
  availableLanguages,
  onChanged,
  onDelete,
}: {
  link: LinkRow;
  availableLanguages: string[];
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(link.url);
  const [quality, setQuality] = useState<Quality>(link.quality);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(link.languages || []);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await api(`/api/admin/links/${link.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ url, quality, languages: selectedLanguages }),
    });
    setBusy(false);
    setEditing(false);
    onChanged();
  }

  function handleLanguageChange(lang: string, isChecked: boolean) {
    setSelectedLanguages((prev) => (isChecked ? [...prev, lang] : prev.filter((l) => l !== lang)));
  }

  return (
    <div className="bg-bg/40 border border-border rounded-xl p-3 md:p-4 hover:border-white/10 transition-all group">
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Quality">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm"
              >
                {QUALITIES.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="URL">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Languages">
            <div className="flex flex-wrap gap-2 py-1">
              {availableLanguages.map((lang) => (
                <label key={lang} className={`flex items-center gap-2 text-[10px] font-bold border rounded-lg px-3 py-1.5 cursor-pointer transition-all ${
                  selectedLanguages.includes(lang) ? 'bg-brand/10 border-brand/40 text-white' : 'bg-bg border-border text-text-dim hover:border-white/20'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedLanguages.includes(lang)}
                    onChange={(e) => handleLanguageChange(lang, e.target.checked)}
                    className="hidden"
                  />
                  {lang}
                </label>
              ))}
            </div>
          </Field>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setUrl(link.url);
                setQuality(link.quality);
                setSelectedLanguages(link.languages || []);
              }}
              className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-border rounded-lg hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="text-[10px] font-black uppercase tracking-widest px-6 py-2 bg-brand text-white rounded-lg transition-all inline-flex items-center gap-2"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-1 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/80 border border-white/5">
                {link.quality}
              </span>
              <span
                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                  link.type === 'direct'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}
              >
                {link.type}
              </span>
              {link.languages && link.languages.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {link.languages.map(l => (
                    <span key={l} className="text-[9px] font-bold text-text-dim px-1.5 py-0.5 bg-white/2 rounded border border-white/5">{l}</span>
                  ))}
                </div>
              )}
              {link.expiresAt && link.expiresAt * 1000 > Date.now() && (
                <span className="text-[9px] font-black uppercase tracking-widest text-green-400/80">Cached</span>
              )}
            </div>
            <div className="text-xs text-text-dim break-all line-clamp-1 group-hover:line-clamp-none transition-all">
              {link.url}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => setEditing(true)}
              className="p-2 text-text-dim hover:text-white hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-all"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-text-dim hover:text-brand hover:bg-brand/10 rounded-lg border border-transparent hover:border-brand/20 transition-all"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
