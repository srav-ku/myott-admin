'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

type Ad = {
  id: number;
  position: string;
  type: string;
  provider: string;
  imageUrl?: string;
  redirectUrl?: string;
  unitId?: string;
  priority: number;
};

type AdContextType = {
  ads: Record<string, Ad[]>;
  loading: boolean;
  hasActiveAd: (position: string, type?: string) => boolean;
  getAd: (position: string, type?: string) => Ad | null;
};

const AdContext = createContext<AdContextType>({ 
  ads: {}, 
  loading: true,
  hasActiveAd: () => false,
  getAd: () => null,
});

export function AdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ads, setAds] = useState<Record<string, Ad[]>>({});
  const [loading, setLoading] = useState(true);

  async function loadAds() {
    setLoading(true);
    try {
      const r = await api<{ ads: Record<string, Ad[]> }>('/api/ads');
      if (r.ok) {
        setAds(r.data.ads);
      } else {
        setAds({});
      }
    } catch (error) {
      console.error('Failed to load ads:', error);
      setAds({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAds();
  }, [user?.stealthMode]);

  const hasActiveAd = (position: string, type?: string) => {
    const posAds = ads[position];
    if (!posAds || posAds.length === 0) return false;
    if (!type) return true;
    return posAds.some(ad => ad.type === type);
  };

  const getAd = (position: string, type?: string) => {
    const posAds = ads[position];
    if (!posAds || posAds.length === 0) return null;
    if (!type) return posAds[0];
    return posAds.find(ad => ad.type === type) || null;
  };

  return (
    <AdContext.Provider value={{ ads, loading, hasActiveAd, getAd }}>
      {children}
    </AdContext.Provider>
  );
}

export const useAds = () => useContext(AdContext);
