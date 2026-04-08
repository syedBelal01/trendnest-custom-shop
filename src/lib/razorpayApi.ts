import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';
import type { Order } from '@/types';

type RazorpayCreateOrderResp = {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
};

export async function createRazorpayOrderApi(orderId: string): Promise<RazorpayCreateOrderResp> {
  const res = await fetch(apiUrl('/api/payments/razorpay/order'), {
    method: 'POST',
    credentials: 'include',
    headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create Razorpay order');
  return data as RazorpayCreateOrderResp;
}

export async function verifyRazorpayPaymentApi(input: {
  orderId: string;
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

