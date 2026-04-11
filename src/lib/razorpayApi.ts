import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import type { Order } from '@/types';
import type { CreateOrderPayload } from '@/lib/ordersApi';

type RazorpayCreateOrderResp = {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
};

export async function createRazorpayPaymentSessionApi(payload: CreateOrderPayload): Promise<RazorpayCreateOrderResp & { sessionId: string }> {
  const res = await fetch(apiUrl('/api/payments/razorpay/session'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const base = typeof (data as any).error === 'string' ? (data as any).error : 'Failed to start payment';
    const st = (data as any).serverTotal;
    const extra =
      typeof st === 'number' && Number.isFinite(st) ? ` (correct total ₹${st.toFixed(2)})` : '';
    throw new Error(`${base}${extra}`);
  }
  return {
    keyId: String((data as any).keyId),
    razorpayOrderId: String((data as any).razorpayOrderId),
    amount: Number((data as any).amount),
    currency: String((data as any).currency || 'INR'),
    sessionId: String((data as any).session?.id || ''),
  };
}

export async function verifyRazorpayPaymentApi(input: {
  sessionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ ok: true; order: Order }> {
  const res = await fetch(apiUrl('/api/payments/razorpay/verify'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Payment verification failed');
  return data as { ok: true; order: Order };
}

export async function cancelRazorpayPaymentSessionApi(sessionId: string): Promise<void> {
  const res = await fetch(apiUrl('/api/payments/razorpay/cancel'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to cancel payment');
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export async function loadRazorpayCheckoutJs(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.setAttribute('data-razorpay-checkout', '1');
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Razorpay checkout failed to load'));
    document.body.appendChild(s);
  });
}

