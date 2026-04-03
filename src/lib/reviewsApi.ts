import { apiUrl } from '@/lib/api';

export type ReviewImage = { url: string; publicId?: string };

export type Review = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  images?: ReviewImage[];
  createdAt?: string;
};

export async function fetchProductReviewsApi(params: {
  productId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<{ reviews: Review[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  qs.set('limit', String(params.limit ?? 5));
  if (params.cursor) qs.set('cursor', params.cursor);
  const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(params.productId)}/reviews?${qs.toString()}`));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load reviews');
  return { reviews: (data.reviews ?? []) as Review[], nextCursor: (data.nextCursor ?? null) as string | null };
}

export async function fetchReviewPromptsApi(): Promise<Array<{ productId: string; orderId: string; deliveredAt?: string | null }>> {
  const res = await fetch(apiUrl('/api/me/review-prompts'), { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load review prompts');
  return (data.prompts ?? []) as Array<{ productId: string; orderId: string; deliveredAt?: string | null }>;
}

export async function dismissReviewPromptApi(productId: string): Promise<void> {
  const res = await fetch(apiUrl('/api/me/review-prompts/dismiss'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to dismiss prompt');
}

export async function uploadReviewImageApi(
  fileOrBlob: File | Blob,
  opts?: { filename?: string }
): Promise<ReviewImage> {
  const fd = new FormData();
  const filename =
    opts?.filename ||
    (fileOrBlob instanceof File ? fileOrBlob.name : '') ||
    `review-${Date.now()}.jpg`;
  fd.append('image', fileOrBlob, filename);
  const res = await fetch(apiUrl('/api/upload/review-image'), {
    method: 'POST',
    credentials: 'include',
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed');
  return { url: String(data.url), publicId: data.publicId ? String(data.publicId) : undefined };
}

export async function createReviewApi(payload: {
  productId: string;
  rating: number;
  comment: string;
  images?: ReviewImage[];
}): Promise<Review> {
  const res = await fetch(apiUrl('/api/reviews'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to submit review');
  return (data.review ?? null) as Review;
}

