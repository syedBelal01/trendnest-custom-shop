import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import type { CartItem, CustomerInfo, Order, OrderStatus } from '@/types';

const ADMIN_KEY_STORAGE = 'trendnest-admin-api-key';

export function getAdminApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setAdminApiKeyInSession(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
}

export function clearAdminApiKey(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

function adminHeaders(): HeadersInit {
  const key = getAdminApiKey();
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export function cartItemsToOrderLines(items: CartItem[]) {
  return items.map(i => ({
    cartLineId: i.cartLineId,
    productId: i.product.id,
    name: i.product.name,
    price: i.product.price,
    quantity: i.quantity,
    selectedSize: i.selectedSize,
    selectedVariant: i.selectedVariant,
    selectedSleeve: i.selectedSleeve,
    customDesignFile: i.customDesignFile,
    customDesignName: i.customDesignName,
    customProductType: i.customProductType,
  }));
}

export type CreateOrderPayload = {
  customer: CustomerInfo;
  items: ReturnType<typeof cartItemsToOrderLines>;
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  hasCustomPrint: boolean;
  paymentMethod?: 'cod' | 'razorpay';
};

export async function createOrderApi(payload: CreateOrderPayload): Promise<Order> {
  const res = await fetch(apiUrl('/api/orders'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Order failed (${res.status})`);
  }
  return data as Order;
}

export async function fetchOrdersAdmin(): Promise<Order[]> {
  const res = await fetch(apiUrl('/api/admin/orders'), { headers: adminHeaders(), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Failed to load orders (${res.status})`);
  }
  return data as Order[];
}

export async function syncOrderShippingStatusAdmin(orderId: string): Promise<Order> {
  const res = await fetch(apiUrl(`/api/admin/orders/${encodeURIComponent(orderId)}/sync-shipping-status`), {
    method: 'POST',
    headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Sync failed (${res.status})`);
  }
  return (data.order ?? null) as Order;
}

export async function patchOrderStatusApi(id: string, status: OrderStatus): Promise<Order> {
  const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `Update failed (${res.status})`);
  }
  return data as Order;
}

export async function downloadOrderInvoicePdf(orderId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(orderId)}/invoice.pdf`), {
    headers: adminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.error === 'string' ? err.error : 'Failed to download invoice');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${orderId.replace(/[^\w.-]+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
