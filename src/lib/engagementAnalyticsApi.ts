import { apiUrl } from '@/lib/api';
import { withAuthHeaders } from '@/lib/authApi';

type EngagementEventPayload = {
  eventType: 'add_to_cart' | 'checkout_view';
  productId?: string;
  productName?: string;
  path?: string;
};

async function trackEvent(payload: EngagementEventPayload): Promise<void> {
  try {
    await fetch(apiUrl('/api/analytics/events'), {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
  } catch {
    // Best effort only; never block UX.
  }
}

export async function trackAddToCartEvent(params: {
  productId?: string;
  productName?: string;
}): Promise<void> {
  await trackEvent({
    eventType: 'add_to_cart',
    productId: params.productId,
    productName: params.productName,
    path: typeof window !== 'undefined' ? window.location.pathname : '/unknown',
  });
}

export async function trackCheckoutViewEvent(): Promise<void> {
  await trackEvent({
    eventType: 'checkout_view',
    path: typeof window !== 'undefined' ? window.location.pathname : '/checkout',
  });
}
