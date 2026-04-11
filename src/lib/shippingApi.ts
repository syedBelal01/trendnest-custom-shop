import { apiUrl } from '@/lib/api';
import type { CartItem } from '@/types';

export type ShippingServiceabilityResult =
  | {
      ok: true;
      shippingCharge: number;
      freeShippingApplied: boolean;
      estimatedDeliveryDays: number | null;
      estimatedDeliveryDate: string | null;
      courierSuggestions: Array<{
        courierId?: number;
        courierName?: string;
        rate: number;
        etd?: string;
        rating?: number;
      }>;
      quoteId?: string;
      cached?: boolean;
    }
  | {
      ok: false;
      reason: 'unavailable' | 'not_serviceable';
      error?: string;
      courierSuggestions?: Array<unknown>;
    };

function cartItemsToServiceabilityItems(items: CartItem[]) {
  return items.map(i => ({
    productId: i.product.id,
    quantity: i.quantity,
  }));
}

export async function fetchShippingServiceabilityApi(input: {
  pincode: string;
  items: CartItem[];
  paymentMethod: 'cod' | 'razorpay';
  /** Merchandise total after coupon (rupees); used for free-shipping threshold on the server. */
  goodsAfterDiscount?: number;
  subtotal?: number;
  total?: number;
}): Promise<ShippingServiceabilityResult> {
  const res = await fetch(apiUrl('/api/shipping/serviceability'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pincode: input.pincode,
      paymentMethod: input.paymentMethod,
      items: cartItemsToServiceabilityItems(input.items),
      goodsAfterDiscount: input.goodsAfterDiscount,
      subtotal: input.subtotal,
      total: input.total,
    }),
  });
  const data = await res.json().catch(() => ({}));
  // endpoint returns 200 even on unavailable; still guard:
  if (!res.ok) {
    return { ok: false, reason: 'unavailable', error: 'Shipping service temporarily unavailable' };
  }
  return data as ShippingServiceabilityResult;
}

