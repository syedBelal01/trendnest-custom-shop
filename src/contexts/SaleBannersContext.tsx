import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HeroBannerSettings, SaleBanner, SaleBannerTheme } from '@/types';
import { fetchActiveHeroBannersWithSettingsApi } from '@/lib/heroBannersApi';

type SaleBannersContextValue = {
  activeBanners: SaleBanner[];
  heroSettings: HeroBannerSettings;
  activeTheme: SaleBannerTheme | null;
  loading: boolean;
  refreshActiveBanners: () => Promise<void>;
};

const SaleBannersContext = createContext<SaleBannersContextValue | undefined>(undefined);
const DEFAULT_HERO_SETTINGS: HeroBannerSettings = { firstSlideMode: 'auto', firstBannerId: '' };

function sortByPriorityAndDate(rows: SaleBanner[]): SaleBanner[] {
  return [...rows].sort((a, b) => {
    const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 100;
    const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100;
    if (pa !== pb) return pa - pb;
    const sa = new Date(a.startDate).getTime();
    const sb = new Date(b.startDate).getTime();
    if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function SaleBannersProvider({ children }: { children: ReactNode }) {
  const [activeBanners, setActiveBanners] = useState<SaleBanner[]>([]);
  const [heroSettings, setHeroSettings] = useState<HeroBannerSettings>(DEFAULT_HERO_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshActiveBanners = useCallback(async () => {
    try {
      const next = await fetchActiveHeroBannersWithSettingsApi();
      setActiveBanners(sortByPriorityAndDate(next.banners));
      setHeroSettings(next.settings || DEFAULT_HERO_SETTINGS);
    } catch {
      setActiveBanners([]);
      setHeroSettings(DEFAULT_HERO_SETTINGS);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next = await fetchActiveHeroBannersWithSettingsApi();
        if (!cancelled) {
          setActiveBanners(sortByPriorityAndDate(next.banners));
          setHeroSettings(next.settings || DEFAULT_HERO_SETTINGS);
        }
      } catch {
        if (!cancelled) {
          setActiveBanners([]);
          setHeroSettings(DEFAULT_HERO_SETTINGS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshActiveBanners();
    };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshActiveBanners();
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(t);
    };
  }, [refreshActiveBanners]);

  const activeTheme = useMemo<SaleBannerTheme | null>(() => {
    const top = activeBanners[0];
    if (!top) return null;
    const theme = String(top.theme || 'default') as SaleBannerTheme;
    return theme === 'default' ? null : theme;
  }, [activeBanners]);

  return (
    <SaleBannersContext.Provider value={{ activeBanners, heroSettings, activeTheme, loading, refreshActiveBanners }}>
      {children}
    </SaleBannersContext.Provider>
  );
}

export function useSaleBanners() {
  const ctx = useContext(SaleBannersContext);
  if (!ctx) throw new Error('useSaleBanners must be used within SaleBannersProvider');
  return ctx;
}
