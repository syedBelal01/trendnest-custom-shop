import { apiUrl } from '@/lib/api';
import type { Coupon } from '@/types';

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem('trendnest-admin-api-key');
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export async function fetchCouponsAdmin(): Promise<Coupon[]> {
  const res = await fetch(apiUrl('/api/coupons'), { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load coupons');
  return data as Coupon[];
}

export async function createCouponAdmin(payload: Partial<Coupon>): Promise<Coupon> {
  const res = await fetch(apiUrl('/api/coupons'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create coupon');
  return data as Coupon;
}

export async function updateCouponAdmin(id: string, payload: Partial<Coupon>): Promise<Coupon> {
  const res = await fetch(apiUrl(`/api/coupons/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update coupon');
  return data as Coupon;
}

export async function deleteCouponAdmin(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/coupons/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete coupon');
  }
}

export async function validateCouponApi(params: {
  code: string;
  subtotal: number;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<{ couponCode: string; discount: number }> {
  const res = await fetch(apiUrl('/api/coupons/validate'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Invalid coupon');
  }
  return { couponCode: data.couponCode, discount: data.discount } as { couponCode: string; discount: number };
}

