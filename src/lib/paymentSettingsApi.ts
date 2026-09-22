import { apiUrl } from '@/lib/api';

export type PartialMode = 'amount' | 'percentage';

export type PaymentSettings = {
  enableFullCod: boolean;
  enableFullOnline: boolean;
  enablePartial: boolean;
  partialMode: PartialMode;
  partialAmount: number;
  partialPercent: number;
  updatedAt?: string;
};

export type PartialQuote = {
  orderTotal: number;
  onlineDue: number;
  codDue: number;
  partialMode: PartialMode;
  partialAmount?: number;
  partialPercent?: number;
  subtotal?: number;
  discount?: number;
};

function adminHeaders(): HeadersInit {
  const key = typeof window !== 'undefined' ? sessionStorage.getItem('trendnest-admin-api-key') : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) h['X-Admin-Key'] = key;
  return h;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
}

function normalizeSettings(raw: any): PaymentSettings {
  return {
    enableFullCod: raw?.enableFullCod !== false,
    enableFullOnline: raw?.enableFullOnline !== false,
    enablePartial: !!raw?.enablePartial,
    partialMode: raw?.partialMode === 'amount' ? 'amount' : 'percentage',
    partialAmount: Number(raw?.partialAmount) || 0,
    partialPercent: Number(raw?.partialPercent) || 0,
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

export async function fetchPaymentSettingsPublic(): Promise<PaymentSettings> {
  const res = await fetch(apiUrl('/api/payment-settings'), { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return normalizeSettings(data?.settings);
}

export async function fetchPaymentSettingsAdmin(): Promise<PaymentSettings> {
  const res = await fetch(apiUrl('/api/admin/payment-settings'), {
    headers: adminHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return normalizeSettings(data?.settings);
}

export async function patchPaymentSettingsAdmin(
  patch: Partial<PaymentSettings>
): Promise<PaymentSettings> {
  const res = await fetch(apiUrl('/api/admin/payment-settings'), {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save');
  return normalizeSettings(data?.settings);
}

export async function fetchPartialQuoteApi(payload: {
  items: unknown[];
  couponCode?: string;
  pincode?: string;
  customer?: { pincode?: string };
  declaredSubtotal?: number;
  declaredTotal?: number;
}): Promise<PartialQuote> {
  const res = await fetch(apiUrl('/api/payments/partial-quote'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to quote');
  return {
    orderTotal: Number(data.orderTotal) || 0,
    onlineDue: Number(data.onlineDue) || 0,
    codDue: Number(data.codDue) || 0,
    partialMode: data.partialMode === 'amount' ? 'amount' : 'percentage',
    partialAmount: data.partialAmount != null ? Number(data.partialAmount) : undefined,
    partialPercent: data.partialPercent != null ? Number(data.partialPercent) : undefined,
    subtotal: data.subtotal != null ? Number(data.subtotal) : undefined,
    discount: data.discount != null ? Number(data.discount) : undefined,
  };
}

export async function collectCodAdminApi(orderId: string): Promise<import('@/types').Order> {
  const res = await fetch(apiUrl(`/api/admin/orders/${encodeURIComponent(orderId)}/collect-cod`), {
    method: 'POST',
    headers: adminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to collect COD');
  return data.order as import('@/types').Order;
}
