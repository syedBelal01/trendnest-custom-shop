import type { CartItem, Order } from '@/types';
import { productUnitPriceForPaymentMethod } from '@/lib/productPayment';

type MetaPixelEventName = 'Purchase';

type Fbq = (
  method: 'track',
  eventName: MetaPixelEventName,
  params?: Record<string, unknown>,
  options?: { eventID?: string }
) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

function asMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export function trackMetaPurchase(order: Order, cartItems: CartItem[]): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;

  const orderId = String(order.id || '').trim();
  const cartItemsByProductId = new Map(cartItems.map((item) => [item.product.id, item]));
  const paymentMethod = order.paymentMethod === 'razorpay' ? 'razorpay' : 'cod';
  const sourceItems = order.items.length
    ? order.items.map((item) => ({
        id: item.productId,
        quantity: item.quantity,
        item_price: asMoney(item.price),
      }))
    : cartItems.map((item) => ({
        id: item.product.id,
        quantity: item.quantity,
        item_price: asMoney(
          productUnitPriceForPaymentMethod(item.product, paymentMethod, item.selectedVariant)
        ),
      }));
  const contents = sourceItems.map((item) => ({
    ...item,
    item_name: cartItemsByProductId.get(item.id)?.product.name,
  }));

  window.fbq(
    'track',
    'Purchase',
    {
      value: asMoney(order.total),
      currency: 'INR',
      content_type: 'product',
      content_ids: contents.map((item) => item.id),
      contents,
      num_items: contents.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      order_id: orderId,
    },
    orderId ? { eventID: `purchase-${orderId}` } : undefined
  );
}
