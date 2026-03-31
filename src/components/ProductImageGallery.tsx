import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { productPrimaryImage } from '@/lib/productImages';

type Props = {
  productId: string;
  images: string[] | undefined;
  productName: string;
  className?: string;
  /** When variant (or image set) changes, reset the main thumbnail selection. */
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

  useEffect(() => {
    setIndex(0);
  }, [productId, resetKey]);

  const safeIndex = Math.min(index, display.length - 1);
  const mainSrc = display[safeIndex] ?? display[0];

  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:gap-4 md:items-start', className)}>
      {display.length > 1 && (
        <div
          className="flex flex-row gap-2 overflow-x-auto pb-1 md:flex-col md:max-h-[min(100vw-2rem,32rem)] md:overflow-y-auto md:pb-0 md:pr-1 shrink-0 order-2 md:order-1"
          role="tablist"
          aria-label="Product thumbnails"
        >
          {display.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              onClick={() => setIndex(i)}
              className={cn(
                'relative shrink-0 rounded-lg overflow-hidden border-2 bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'h-16 w-16 sm:h-20 sm:w-20 md:h-[4.5rem] md:w-[4.5rem]',
                i === safeIndex
                  ? 'border-primary ring-2 ring-primary/30 shadow-sm'
                  : 'border-transparent opacity-80 hover:opacity-100 hover:border-muted-foreground/25'
              )}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          'aspect-square rounded-xl overflow-hidden border bg-muted shadow-sm flex-1 min-w-0 order-1 md:order-2'
        )}
      >
        <img
          src={mainSrc}
          alt={productName}
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>
    </div>
  );
}
