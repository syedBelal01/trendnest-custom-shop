import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import type { Coupon, CouponPaymentMethodScope } from '@/types';

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
  paymentMethod: 'cod' | 'razorpay';
  items: Array<{ productId: string; quantity: number; selectedVariant?: string }>;
}): Promise<{ couponCode: string; discount: number; paymentMethodScope: CouponPaymentMethodScope }> {
  const res = await fetch(apiUrl('/api/coupons/validate'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Invalid coupon');
  }
  const scope =
    data?.paymentMethodScope === 'online' || data?.paymentMethodScope === 'cod' || data?.paymentMethodScope === 'both'
      ? data.paymentMethodScope
      : 'both';
  return {
    couponCode: data.couponCode,
    discount: data.discount,
    paymentMethodScope: scope,
  } as { couponCode: string; discount: number; paymentMethodScope: CouponPaymentMethodScope };
}

