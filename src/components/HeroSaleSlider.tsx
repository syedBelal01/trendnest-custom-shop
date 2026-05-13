import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import HeroCarousel from '@/components/HeroCarousel';
import { useSaleBanners } from '@/contexts/SaleBannersContext';
import type { HeroBannerSettings, SaleBanner } from '@/types';

const INTERVAL_MS = 5200;

type Slide =
  | { id: 'default'; kind: 'default'; priority: number }
  | { id: string; kind: 'sale'; banner: SaleBanner; priority: number };

const DEFAULT_SLIDE_PRIORITY = 100;

function applyFirstSlidePreference(slides: Slide[], settings: HeroBannerSettings): Slide[] {
  if (slides.length <= 1) return slides;
  const mode = String(settings?.firstSlideMode || 'auto');
  if (mode === 'default') {
    const idx = slides.findIndex((s) => s.kind === 'default');
    if (idx <= 0) return slides;
    const first = slides[idx];
    return [first, ...slides.slice(0, idx), ...slides.slice(idx + 1)];
  }
  if (mode === 'banner') {
    const targetId = String(settings?.firstBannerId || '').trim();
    if (!targetId) return slides;
    const idx = slides.findIndex((s) => s.kind === 'sale' && s.id === targetId);
    if (idx <= 0) return slides;
    const first = slides[idx];
    return [first, ...slides.slice(0, idx), ...slides.slice(idx + 1)];
  }
  return slides;
}

function saleThemeClasses(theme: SaleBanner['theme']): string {
  switch (theme) {
    case 'winter':
      return 'from-sky-50 via-white to-cyan-100 border-sky-100';
    case 'summer':
      return 'from-amber-50 via-orange-50 to-yellow-100 border-amber-100';
    case 'eid':
      return 'from-emerald-50 via-teal-50 to-cyan-100 border-emerald-100';
    case 'holi':
      return 'from-pink-50 via-orange-50 to-indigo-100 border-fuchsia-100';
    case 'diwali':
      return 'from-amber-50 via-orange-50 to-rose-100 border-orange-100';
    case 'flash':
      return 'from-rose-50 via-orange-50 to-yellow-100 border-rose-100';
    default:
      return 'from-orange-50 via-white to-orange-100 border-orange-100';
  }
}

function saleBadgeLabel(theme: SaleBanner['theme']): string {
  switch (theme) {
    case 'winter':
      return 'Winter Sale';
    case 'summer':
      return 'Summer Sale';
    case 'eid':
      return 'Eid Sale';
    case 'holi':
      return 'Holi Sale';
    case 'diwali':
      return 'Diwali Sale';
    case 'flash':
      return 'Flash Sale';
    default:
      return 'Live Sale';
  }
}

function saleSlugify(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function toHref(raw: string | undefined, banner?: SaleBanner): string {
  const slug = saleSlugify(banner?.slug || banner?.title || banner?.id || '');
  if (slug) return `/sale/${slug}`;
  const val = String(raw ?? '').trim();
  if (!val) return '/category/trending';
  if (val.startsWith('/')) return val;
  return `/${val}`;
}

function SaleBannerSlide({ banner }: { banner: SaleBanner }) {
  const hasBannerImage = Boolean(String(banner.mobileImage || banner.desktopImage || '').trim());
  const saleHref = toHref(banner.ctaLink, banner);

  return (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-3xl border bg-gradient-to-br shadow-sm',
        saleThemeClasses(banner.theme)
      )}
    >
      {hasBannerImage ? (
        <picture className="absolute inset-0">
          {banner.desktopImage ? <source media="(min-width: 768px)" srcSet={banner.desktopImage} /> : null}
          <img
            src={banner.mobileImage || banner.desktopImage}
            alt={banner.title}
            className="h-full w-full object-cover object-center"
            loading="lazy"
            decoding="async"
          />
        </picture>
      ) : null}

      <div
        className={cn(
          'absolute inset-0',
          hasBannerImage ? 'bg-gradient-to-t from-black/35 via-black/10 to-transparent' : 'bg-transparent'
        )}
      />
      <Link
        to={saleHref}
        aria-label={`Open ${banner.title} sale`}
        className="absolute inset-0 z-[5]"
      />

      <div className="pointer-events-none relative z-10 flex h-full items-end p-4 sm:p-5 md:p-8">
        <Link
          to={saleHref}
          className="pointer-events-auto inline-flex items-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700"
        >
          {banner.ctaText?.trim() || 'Shop Now'} <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function DefaultHeroSlide() {
  return (
    <div className="relative h-full overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-5 shadow-sm md:p-8">
      <div className="absolute right-12 top-8 h-28 w-28 rounded-full bg-orange-200/40 blur-2xl" />
      <div className="absolute bottom-8 left-1/3 h-20 w-20 rounded-full bg-orange-300/20 blur-2xl" />
      <div className="relative z-10 grid h-full items-center gap-6 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-orange-600 shadow-sm">
            New Arrivals
          </span>
          <h1 className="mt-5 max-w-xl text-4xl font-black leading-[0.95] tracking-tight text-slate-950 sm:text-5xl md:text-6xl">
            Style Meets <span className="text-orange-600">Affordability</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-600 md:text-base">
            Discover trending fashion, home & kitchen products and custom prints - all at unbeatable prices.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/category/trending"
              className="inline-flex items-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700"
            >
              Shop Trending <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/category/home"
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Shop Style
            </Link>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="relative flex aspect-square w-full max-w-[240px] items-stretch justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-100 shadow-2xl shadow-orange-200/50 sm:max-w-[280px] md:max-w-md">
            <div className="absolute bottom-8 h-20 w-64 rounded-[50%] bg-slate-900/10 blur-xl" />
            <div className="relative z-10 h-full w-full">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSaleSlider() {
  const { activeBanners, heroSettings } = useSaleBanners();
  const saleSlides = useMemo(
    () =>
      [...activeBanners]
        .sort((a, b) => {
          const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 100;
          const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100;
          if (pa !== pb) return pa - pb;
          return String(a.id).localeCompare(String(b.id));
        })
        .map((banner) => ({
          id: banner.id,
          kind: 'sale',
          banner,
          priority: Number.isFinite(Number(banner.priority)) ? Number(banner.priority) : 100,
        }) as Slide),
    [activeBanners]
  );

  const slides = useMemo<Slide[]>(() => {
    const ordered = [...saleSlides, { id: 'default', kind: 'default', priority: DEFAULT_SLIDE_PRIORITY } as Slide]
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.kind === 'default') return 1;
        if (b.kind === 'default') return -1;
        return String(a.id).localeCompare(String(b.id));
      });
    return applyFirstSlidePreference(ordered, heroSettings);
  }, [saleSlides, heroSettings]);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = slides.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setIndex((i) => (i + 1) % count);
      }
    }, INTERVAL_MS);
  }, [clearTimer, count]);

  useEffect(() => {
    setIndex(0);
  }, [count]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  const goTo = useCallback(
    (next: number) => {
      setIndex((next + count) % count);
      startTimer();
    },
    [count, startTimer]
  );

  const activeSlide = slides[index] ?? slides[0];
  const isDefaultActive = activeSlide?.kind === 'default';

  return (
    <section
      className="relative"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div
        className={cn(
          'relative',
          isDefaultActive ? 'min-h-[640px] sm:min-h-[680px] md:min-h-[530px]' : 'min-h-[360px] sm:min-h-[420px] md:min-h-[530px]'
        )}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-out',
              i === index ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          >
            {slide.kind === 'default' ? <DefaultHeroSlide /> : <SaleBannerSlide banner={slide.banner} />}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous hero slide"
            className="absolute left-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-white md:left-3"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next hero slide"
            className="absolute right-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow-md ring-1 ring-slate-200 transition hover:bg-white md:right-3"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      ) : null}

      {count > 1 ? (
        <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Hero slides">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-current={i === index ? 'true' : undefined}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all',
                i === index ? 'w-7 bg-primary' : 'bg-muted-foreground/35 hover:bg-muted-foreground/60'
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
