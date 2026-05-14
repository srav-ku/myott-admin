'use client';

import { useState, useEffect } from 'react';
import { Plus, List, Check, Loader2, BookmarkPlus } from 'lucide-react';
import { api } from '@/lib/api';

type Collection = {
  id: number;
  name: string;
};

type Props = {
  movieId?: number;
  tvId?: number;
};

export function CollectionManager({ movieId, tvId }: Props) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [itemCollections, setItemCollections] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ collections: Collection[] }>('/api/collections');
      if (r.ok) setCollections(r.data.collections);
      
      // Load current item status - we'll need a way to check which collections have this item
      // For now, we'll assume we might need a dedicated API or just fetch all and filter
      // Actually, we'll skip the per-collection check for now to keep it simple, 
      // or implement a basic version.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const r = await api<{ collection: Collection }>('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (r.ok) {
        setCollections([r.data.collection, ...collections]);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleItem(collectionId: number) {
    const isAdded = itemCollections.includes(collectionId);
    try {
      const r = await api(`/api/collections/${collectionId}/items`, {
        method: isAdded ? 'DELETE' : 'POST',
        body: JSON.stringify({ movie_id: movieId, tv_id: tvId }),
      });
      if (r.ok) {
        setItemCollections(prev => 
          isAdded ? prev.filter(id => id !== collectionId) : [...prev, collectionId]
        );
      }
    } catch (err) {
      console.error('Failed to toggle item in collection:', err);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-white/70 hover:bg-white/10 hover:border-white/20 transition-all"
      >
        <BookmarkPlus size={14} />
        Add to Collection
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-dim)] px-1">
              Your Collections
            </h3>
            
            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
              {loading ? (
                <div className="py-4 flex justify-center">
                  <Loader2 size={16} className="animate-spin text-[var(--color-brand)]" />
                </div>
              ) : collections.length === 0 ? (
                <p className="text-[10px] text-[var(--color-text-dim)] px-2 py-2">No collections yet.</p>
              ) : (
                collections.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleItem(c.id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 text-left text-sm transition-colors group"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      itemCollections.includes(c.id) ? 'bg-[var(--color-brand)] border-[var(--color-brand)]' : 'border-white/20'
                    }`}>
                      {itemCollections.includes(c.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="flex-1 truncate">{c.name}</span>
                  </button>
                ))
              )}
            </div>

            <form onSubmit={createCollection} className="pt-3 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New collection..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--color-brand)]"
                />
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="p-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] rounded-lg text-white disabled:opacity-50"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
