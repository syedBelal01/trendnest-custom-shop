import { apiUrl } from '@/lib/api';
import type { Order } from '@/types';

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem('trendnest-admin-api-key');
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export type AdminReturnRow = {
  orderId: string;
  customer: Order['customer'];
  paymentMethod?: Order['paymentMethod'];
  order: Order;
  returnRequest: import('@/types').OrderReturnRequest;
};

export async function listAdminReturnsApi(status?: string): Promise<AdminReturnRow[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(apiUrl(`/api/admin/returns${q}`), { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to list returns');
  return (data.returns ?? []) as AdminReturnRow[];
}

export async function approveReturnApi(orderId: string, returnId: string, adminNotes?: string): Promise<Order> {
  const res = await fetch(
    apiUrl(`/api/admin/returns/${encodeURIComponent(orderId)}/${encodeURIComponent(returnId)}/approve`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ adminNotes: adminNotes ?? '' }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Approve failed');
  return data.order as Order;
}

export async function rejectReturnApi(orderId: string, returnId: string, rejectionReason: string): Promise<Order> {
  const res = await fetch(
    apiUrl(`/api/admin/returns/${encodeURIComponent(orderId)}/${encodeURIComponent(returnId)}/reject`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ rejectionReason }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Reject failed');
  return data.order as Order;
}

export async function setReverseShipmentApi(
  orderId: string,
  returnId: string,
  body: { awb: string; courierName?: string; source?: 'manual' | 'shiprocket' }
): Promise<Order> {
  const res = await fetch(
    apiUrl(`/api/admin/returns/${encodeURIComponent(orderId)}/${encodeURIComponent(returnId)}/reverse-shipment`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Save failed');
  return data.order as Order;
}

export async function markReturnPickedUpApi(orderId: string, returnId: string): Promise<Order> {
  const res = await fetch(
    apiUrl(`/api/admin/returns/${encodeURIComponent(orderId)}/${encodeURIComponent(returnId)}/mark-picked-up`),
    { method: 'POST', headers: adminHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Update failed');
  return data.order as Order;
}

export async function markReturnReceivedApi(orderId: string, returnId: string): Promise<Order> {
  const res = await fetch(
    apiUrl(`/api/admin/returns/${encodeURIComponent(orderId)}/${encodeURIComponent(returnId)}/mark-received`),
    { method: 'POST', headers: adminHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Update failed');
  return data.order as Order;
}

export async function refundReturnApi(
  orderId: string,
  returnId: string,
  kind?: 'manual' | 'store_credit'
): Promise<Order> {
  const res = await fetch(
    apiUrl(`/api/admin/returns/${encodeURIComponent(orderId)}/${encodeURIComponent(returnId)}/refund`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ kind: kind ?? 'manual' }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Refund failed');
  return data.order as Order;
}
