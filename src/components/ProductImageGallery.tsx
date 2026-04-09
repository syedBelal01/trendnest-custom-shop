import { useEffect, useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { productPrimaryImage } from '@/lib/productImages';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  productId: string;
  images: string[] | undefined;
  productName: string;
  className?: string;
  resetKey?: string;
};

export default function ProductImageGallery({
  productId,
  images,
  productName,
  className,
  resetKey = '',
}: Props) {
  const list = useMemo(
    () => (images ?? []).map(s => s.trim()).filter(Boolean),
    [images]
  );
  const display = list.length ? list : [productPrimaryImage({ images: [], variantOptions: undefined })];
  const [index, setIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [productId, resetKey]);

  const safeIndex = Math.min(index, display.length - 1);
  const mainSrc = display[safeIndex] ?? display[0];

  const goTo = useCallback((i: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIndex(i);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 150);
  }, []);

  const goPrev = () => goTo(safeIndex > 0 ? safeIndex - 1 : display.length - 1);
  const goNext = () => goTo(safeIndex < display.length - 1 ? safeIndex + 1 : 0);

  // Swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goNext() : goPrev();
    }
    setTouchStart(null);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="md:flex md:items-start md:gap-3">
        {/* Left thumbnails (desktop only) */}
        {display.length > 1 && (
          <div
            className="hidden md:flex md:flex-col gap-2 max-h-[32rem] overflow-y-auto pr-1 scrollbar-none"
            role="tablist"
            aria-label="Product thumbnails"
          >
            {display.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                onClick={() => goTo(i)}
                className={cn(
                  'relative shrink-0 rounded-xl overflow-hidden border-2 bg-muted transition-all duration-200',
                  'h-16 w-16 lg:h-[4.5rem] lg:w-[4.5rem]',
                  i === safeIndex
                    ? 'border-primary ring-2 ring-primary/20 shadow-sm'
                    : 'border-transparent opacity-70 hover:opacity-100 hover:border-border'
                )}
              >
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div
          className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-sm md:flex-1"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={mainSrc}
            alt={productName}
            className={cn(
              'h-full w-full object-cover transition-all duration-300',
              isTransitioning ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'
            )}
            loading="eager"
          />

          {/* Nav arrows – hidden on mobile (use swipe), shown on md+ */}
          {display.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm hover:bg-background transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Dot indicators on mobile */}
          {display.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 md:hidden">
              {display.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === safeIndex
                      ? 'w-6 h-2 bg-primary'
                      : 'w-2 h-2 bg-foreground/30'
                  )}
                  aria-label={`View image ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Image counter badge */}
          {display.length > 1 && (
            <span className="absolute top-3 right-3 text-[11px] font-medium bg-background/80 backdrop-blur-sm text-foreground/70 px-2 py-0.5 rounded-full border border-border/50">
              {safeIndex + 1}/{display.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
