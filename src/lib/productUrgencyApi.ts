import { apiUrl } from '@/lib/api';
import type { ProductUrgencySetting } from '@/types';

export type ProductUrgencyInput = Omit<ProductUrgencySetting, 'id' | 'createdAt' | 'updatedAt'>;

function adminHeaders(): HeadersInit {
  const key = typeof window !== 'undefined' ? sessionStorage.getItem('trendnest-admin-api-key') : '';
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key && key.trim()) h['X-Admin-Key'] = key.trim();
  return h;
}

export async function fetchProductUrgencyApi(input: {
  productId: string;
  category?: string;
  categories?: string[];
}): Promise<ProductUrgencySetting | null> {
  const productId = String(input.productId || '').trim();
  if (!productId) return null;
  const params = new URLSearchParams();
  if (input.category) params.set('category', input.category);
  if (input.categories?.length) params.set('categories', input.categories.join(','));
  const qs = params.toString();
  try {
    const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(productId)}/urgency${qs ? `?${qs}` : ''}`), {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { urgency?: ProductUrgencySetting | null };
    return data.urgency?.id ? data.urgency : null;
  } catch {
    return null;
  }
}

export async function fetchAdminUrgencySettingsApi(): Promise<ProductUrgencySetting[]> {
  const res = await fetch(apiUrl('/api/admin/product-urgency-settings'), {
    headers: adminHeaders(),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load urgency settings');
  return Array.isArray(data.settings) ? data.settings : [];
}

export async function createAdminUrgencySettingApi(input: ProductUrgencyInput): Promise<ProductUrgencySetting> {
  const res = await fetch(apiUrl('/api/admin/product-urgency-settings'), {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create urgency setting');
  return data.setting;
}

export async function updateAdminUrgencySettingApi(
  id: string,
  input: Partial<ProductUrgencyInput>
): Promise<ProductUrgencySetting> {
  const res = await fetch(apiUrl(`/api/admin/product-urgency-settings/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update urgency setting');
  return data.setting;
}

export async function deleteAdminUrgencySettingApi(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/product-urgency-settings/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete urgency setting');
  }
}
