import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import type { Coupon } from '@/types';

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
}

export type VendorCouponPayload = {
  code: string;
  type: 'percentage' | 'flat';
  value: number;
  maxDiscount?: number | '';
  minOrder?: number;
  paymentMethodScope?: 'online' | 'cod' | 'both';
  productIds?: string[];
  startAt?: string;
  endAt?: string;
  usageTotalLimit?: number | '';
  usagePerUserLimit?: number | '';
  isActive?: boolean;
};

export async function fetchVendorCouponsApi(): Promise<Coupon[]> {
  const res = await fetch(apiUrl('/api/vendor/coupons'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data?.coupons) ? (data.coupons as Coupon[]) : [];
}

export async function createVendorCouponApi(payload: VendorCouponPayload): Promise<Coupon> {
  const res = await fetch(apiUrl('/api/vendor/coupons'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to create coupon');
  if (!data?.coupon?.id) throw new Error('Invalid coupon response');
  return data.coupon as Coupon;
}

export async function updateVendorCouponApi(
  id: string,
  payload: Partial<VendorCouponPayload>
): Promise<Coupon> {
  const res = await fetch(apiUrl(`/api/vendor/coupons/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update coupon');
  if (!data?.coupon?.id) throw new Error('Invalid coupon response');
  return data.coupon as Coupon;
}

export async function deleteVendorCouponApi(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/vendor/coupons/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  if (!res.ok && res.status !== 204) throw new Error(await readError(res));
}
