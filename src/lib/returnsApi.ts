import { apiUrl } from '@/lib/api';
import type { Order } from '@/types';
import { withAuthHeaders } from '@/lib/authApi';

export type MyReturnRow = {
  orderId: string;
  orderTotal: number;
  orderStatus: string;
  returnRequest: import('@/types').OrderReturnRequest;
};

export async function fetchMyReturnsApi(): Promise<MyReturnRow[]> {
  const res = await fetch(apiUrl('/api/me/returns'), {
    method: 'GET',
    credentials: 'include',
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load returns');
  }
  return (data.returns ?? []) as MyReturnRow[];
}

export async function requestReturnApi(payload: {
  orderId: string;
  reason: string;
  images?: string[];
  scope: 'full' | 'partial';
  lines?: Array<{ lineId: string; quantity: number }>;
}): Promise<Order> {
  const res = await fetch(apiUrl('/api/returns/request'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Return request failed');
  }
  return data.order as Order;
}

export async function uploadReturnImageApi(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(apiUrl('/api/upload/return-image'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders(),
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Upload failed');
  }
  return { url: String(data.url || '') };
}
