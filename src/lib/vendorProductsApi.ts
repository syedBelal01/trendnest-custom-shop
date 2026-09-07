import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import { getAdminApiKey } from '@/lib/ordersApi';
import type { Product } from '@/types';

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
}

export async function fetchVendorProductsApi(): Promise<Product[]> {
  const res = await fetch(apiUrl('/api/vendor/products'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data?.products) ? (data.products as Product[]) : [];
}

export type VendorProductPayload = {
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  sku?: string;
  price: number;
  originalPrice?: number | '';
  onlinePrice?: number | '';
  stock?: number;
  images?: string[];
  submitAction?: 'draft' | 'submit';
};

export async function createVendorProductApi(payload: VendorProductPayload): Promise<Product> {
  const res = await fetch(apiUrl('/api/vendor/products'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create product');
  if (!data?.product?.id) throw new Error('Invalid product response');
  return data.product as Product;
}

export async function updateVendorProductApi(
  productId: string,
  payload: Partial<VendorProductPayload> & { submitAction?: 'draft' | 'submit' }
): Promise<Product> {
  const res = await fetch(apiUrl(`/api/vendor/products/${encodeURIComponent(productId)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update product');
  if (!data?.product?.id) throw new Error('Invalid product response');
  return data.product as Product;
}

function adminHeaders(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = getAdminApiKey();
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export async function fetchAdminVendorProductsApi(status?: string): Promise<Product[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/api/admin/vendor-products${q}`), {
    method: 'GET',
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data?.products) ? (data.products as Product[]) : [];
}

export async function patchAdminVendorProductApi(
  productId: string,
  patch: { approvalStatus: string; rejectionReason?: string }
): Promise<Product> {
  const res = await fetch(apiUrl(`/api/admin/vendor-products/${encodeURIComponent(productId)}`), {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update product');
  return data.product as Product;
}
