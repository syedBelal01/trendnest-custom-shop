import { apiUrl } from '@/lib/api';

export type RatingSummary = { avgRating: number; reviewCount: number };

export async function fetchReviewsSummaryApi(productIds: string[]): Promise<Record<string, RatingSummary>> {
  const uniq = [...new Set(productIds.map(s => String(s).trim()).filter(Boolean))].slice(0, 200);
  if (uniq.length === 0) return {};
  const qs = new URLSearchParams({ productIds: uniq.join(',') });
  const res = await fetch(apiUrl(`/api/reviews/summary?${qs.toString()}`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load rating summary');
  return (data.summary ?? {}) as Record<string, RatingSummary>;
}

