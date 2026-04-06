import { apiUrl } from '@/lib/api';

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem('trendnest-admin-api-key');
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export type ProductDraft = {
  draftId: string;
  status: 'draft' | 'published';
  categoryMain: string;
  subcategory: string;
  details: Record<string, unknown>;
  images: { items: string[]; primaryIndex: number };
  variants: Record<string, unknown>;
  publishedProductId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function createProductDraftApi(): Promise<ProductDraft> {
  const res = await fetch(apiUrl('/api/admin/product-drafts'), {
    method: 'POST',
    headers: adminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create draft');
  return data.draft as ProductDraft;
}

export async function listProductDraftsApi(status: 'draft' | 'published' = 'draft'): Promise<ProductDraft[]> {
  const res = await fetch(apiUrl(`/api/admin/product-drafts?status=${encodeURIComponent(status)}`), {
    headers: adminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load drafts');
  return (data.drafts ?? []) as ProductDraft[];
}

export async function fetchProductDraftApi(draftId: string): Promise<ProductDraft> {
  const res = await fetch(apiUrl(`/api/admin/product-drafts/${encodeURIComponent(draftId)}`), {
    headers: adminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load draft');
  return data.draft as ProductDraft;
}

export async function patchProductDraftApi(draftId: string, patch: Partial<ProductDraft>): Promise<ProductDraft> {
  const res = await fetch(apiUrl(`/api/admin/product-drafts/${encodeURIComponent(draftId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save draft');
  return data.draft as ProductDraft;
}

export async function deleteProductDraftApi(draftId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/product-drafts/${encodeURIComponent(draftId)}`), {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete draft');
  }
}

export async function publishProductDraftApi(draftId: string, publishAs: 'draft' | 'published'): Promise<{ draft: ProductDraft; product: unknown }> {
  const res = await fetch(apiUrl(`/api/admin/product-drafts/${encodeURIComponent(draftId)}/publish`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ publishAs }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to publish');
  return { draft: data.draft as ProductDraft, product: data.product };
}

