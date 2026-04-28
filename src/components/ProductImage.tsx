import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PRODUCT_IMAGE } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
  src?: string | null;
  alt: string;
  /** Outer container classes (controls size/aspect). */
  containerClassName?: string;
  /** Image element classes. */
  imgClassName?: string;
  /** Rounded + border box (default true). */
  boxed?: boolean;
  /** Padding inside the box (default: "p-2"). */
  paddingClassName?: string;
};

export default function ProductImage({
  src,
  alt,
  containerClassName,
  imgClassName,
  boxed = true,
  paddingClassName = 'p-2',
}: Props) {
  const initial = useMemo(() => {
    const s = typeof src === 'string' ? src.trim() : '';
    return s || DEFAULT_PRODUCT_IMAGE;
  }, [src]);
  const [cur, setCur] = useState(initial);

  useEffect(() => {
    setCur(initial);
  }, [initial]);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        boxed && 'rounded-xl border border-border bg-muted/20',
        paddingClassName,
        containerClassName
      )}
    >
      <img
        src={cur}
        alt={alt}
        loading="lazy"
        className={cn('max-h-full max-w-full object-contain', imgClassName)}
        onError={(e) => {
          const img = e.currentTarget;
          img.onerror = null;
          setCur(DEFAULT_PRODUCT_IMAGE);
        }}
      />
    </div>
  );
}

