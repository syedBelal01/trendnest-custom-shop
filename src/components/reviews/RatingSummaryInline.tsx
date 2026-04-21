import React, { useMemo } from 'react';

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function computeStars(avgRating: number) {
  const v = clamp(avgRating, 0, 5);
  const full = Math.floor(v);
  const frac = v - full;
  const hasHalf = frac >= 0.25 && frac < 0.75;
  const fullPlus = full + (frac >= 0.75 ? 1 : 0);
  const fullStars = clamp(fullPlus, 0, 5);
  const halfStars = fullStars >= 5 ? 0 : (hasHalf ? 1 : 0);
  const emptyStars = clamp(5 - fullStars - halfStars, 0, 5);
  return { fullStars, halfStars, emptyStars, display: v };
}

function StarIcon(props: { fillPct: 0 | 50 | 100; className?: string }) {
  const base = (
    <span aria-hidden className="text-yellow-500">
      ★
    </span>
  );

  if (props.fillPct === 100) return <span className={props.className}>{base}</span>;
  if (props.fillPct === 0) {
    return (
      <span className={props.className} aria-hidden>
        <span className="text-muted-foreground/35">★</span>
      </span>
    );
  }

  // Half: render empty star, overlay filled star clipped to 50%.
  return (
    <span className={`relative inline-block ${props.className || ''}`} aria-hidden>
      <span className="text-muted-foreground/35">★</span>
      <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
        {base}
      </span>
    </span>
  );
}

export default function RatingSummaryInline(props: {
  avgRating: number;
  reviewCount: number;
  onClick?: () => void;
  className?: string;
  starClassName?: string;
  textClassName?: string;
}) {
  const count = Math.max(0, Math.floor(Number(props.reviewCount) || 0));
  const avg = Number(props.avgRating) || 0;

  const star = useMemo(() => computeStars(avg), [avg]);

  if (count <= 0) {
    return (
      <span className={props.className}>
        <span className={props.textClassName ?? 'text-xs text-muted-foreground'}>No ratings yet</span>
      </span>
    );
  }

  const content = (
    <span className={`inline-flex items-center gap-2 ${props.className || ''}`}>
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: star.fullStars }, (_, i) => (
          <StarIcon key={`f-${i}`} fillPct={100} className={props.starClassName} />
        ))}
        {star.halfStars ? <StarIcon key="h" fillPct={50} className={props.starClassName} /> : null}
        {Array.from({ length: star.emptyStars }, (_, i) => (
          <StarIcon key={`e-${i}`} fillPct={0} className={props.starClassName} />
        ))}
      </span>
      <span className={props.textClassName ?? 'text-sm text-muted-foreground'}>
        {star.display.toFixed(1)} ({count} {count === 1 ? 'review' : 'reviews'})
      </span>
    </span>
  );

  if (!props.onClick) return content;
  return (
    <button type="button" onClick={props.onClick} className="text-left">
      {content}
    </button>
  );
}

