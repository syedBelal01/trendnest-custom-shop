import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Only local slides under `public/` (img1–img4). On load error, uses `placeholder.svg`. */
export const HERO_SLIDE_SRCS = [
  '/img1.webp',
  '/img2.jpg',
  '/img3.jpeg',
  '/img4.jpeg',
] as const;

const INTERVAL_MS = 4000;
const FALLBACK_SLIDE = '/placeholder.svg';

function SlideImage({ src, alt, active }: { src: string; alt: string; active: boolean }) {
  const [useFallback, setUseFallback] = useState(false);
  const effective = useFallback ? FALLBACK_SLIDE : src;

  return (
    <img
      src={effective}
      alt={alt}
      onError={() => setUseFallback(true)}
      className={cn(
        'absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out',
        active ? 'opacity-100 z-[1]' : 'opacity-0 z-0'
      )}
      loading={active ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export default function HeroCarousel({ images }: { images?: string[] }) {
  const slideSrcs = (images?.length ? images : HERO_SLIDE_SRCS as unknown as string[]).filter(Boolean);
  const n = slideSrcs.length || 1;
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setIndex(i => (i + 1) % n);
      }
    }, INTERVAL_MS);
  }, [clearTimer, n]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      startTimer();
    },
    [startTimer]
  );

  return (
    <div
      className="w-full h-full"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className="relative h-full w-full rounded-full overflow-hidden shadow-2xl bg-muted">
        {slideSrcs.map((src, i) => (
          <SlideImage
            key={`${src}-${i}`}
            src={src}
            alt={`TrendNest hero ${i + 1}`}
            active={i === index}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Hero slides">
        {slideSrcs.map((_, i) => (
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
    </div>
  );
}
