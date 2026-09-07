import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import type { OrderStatus } from '@/types';

export type VendorOrderLine = {
  productId: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  selectedVariant?: string;
  selectedSize?: string;
};

export type VendorOrder = {
  id: string;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  amountDue?: number;
  createdAt?: string;
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: VendorOrderLine[];
  goodsTotal: number;
  ownsEntireOrder?: boolean;
  canUpdateStatus?: boolean;
};

export type VendorOrdersSummary = {
  orderCount: number;
  productCount: number;
  pendingEarnings: number;
  commissionPercent: number;
};

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
}

export async function fetchVendorOrdersApi(): Promise<{
  orders: VendorOrder[];
  summary: VendorOrdersSummary;
}> {
  const res = await fetch(apiUrl('/api/vendor/orders'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return {
    orders: Array.isArray(data?.orders) ? (data.orders as VendorOrder[]) : [],
    summary: {
      orderCount: Number(data?.summary?.orderCount) || 0,
      productCount: Number(data?.summary?.productCount) || 0,
      pendingEarnings: Number(data?.summary?.pendingEarnings) || 0,
      commissionPercent: Number(data?.summary?.commissionPercent) || 0,
    },
  };
}

export async function patchVendorOrderStatusApi(
  orderId: string,
  status: OrderStatus
): Promise<VendorOrder> {
  const res = await fetch(apiUrl(`/api/vendor/orders/${encodeURIComponent(orderId)}`), {
    method: 'PATCH',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to update status');
  if (!data?.order?.id) throw new Error('Invalid order response');
  return data.order as VendorOrder;
}

export type AdminVendorOrder = import('@/types').Order & {
  sellerIds?: string[];
  sellerNames?: string[];
};

export async function fetchAdminVendorOrdersApi(): Promise<AdminVendorOrder[]> {
  const key = typeof window !== 'undefined' ? sessionStorage.getItem('trendnest-admin-api-key') : null;
  const headers: Record<string, string> = {};
  if (key) headers['X-Admin-Key'] = key;
  const res = await fetch(apiUrl('/api/admin/vendor-orders'), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data?.orders) ? (data.orders as AdminVendorOrder[]) : [];
}
