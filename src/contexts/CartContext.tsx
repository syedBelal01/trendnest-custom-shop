import React, { createContext, useContext, useMemo, useReducer, useEffect, useCallback } from 'react';
import { CartItem, type CouponPaymentMethodScope, type Product } from '@/types';
import { toast } from 'sonner';
import { useProducts } from '@/contexts/ProductsContext';
import { trackAddToCartEvent } from '@/lib/engagementAnalyticsApi';

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
  couponPaymentMethodScope: CouponPaymentMethodScope;
  couponValidatedFor: 'cod' | 'razorpay' | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { cartLineId: string; quantity: number } }
  | {
      type: 'APPLY_COUPON';
      payload: {
        code: string;
        discount: number;
        paymentMethodScope?: CouponPaymentMethodScope;
        validatedFor?: 'cod' | 'razorpay';
      };
    }
  | { type: 'CLEAR_COUPON' }
  | { type: 'REPLACE_ITEMS'; payload: CartItem[] }
  | { type: 'CLEAR_CART' };

const initialState: CartState = {
  items: [],
  couponCode: null,
  discount: 0,
  couponPaymentMethodScope: 'both',
  couponValidatedFor: null,
};

function normalizeCouponPaymentMethodScope(raw: unknown): CouponPaymentMethodScope {
  const scope = String(raw || '').trim().toLowerCase();
  if (scope === 'online' || scope === 'cod' || scope === 'both') return scope;
  return 'both';
}

function couponScopeAllowsMethod(scope: CouponPaymentMethodScope, method: 'cod' | 'razorpay'): boolean {
  if (scope === 'both') return true;
  if (scope === 'online') return method === 'razorpay';
  return method === 'cod';
}

function sameCartLine(a: CartItem, b: CartItem): boolean {
  const aCustom = !!(a.customDesignFile || a.customDesignName);
  const bCustom = !!(b.customDesignFile || b.customDesignName);
  if (aCustom || bCustom) {
    return (
      a.product.id === b.product.id &&
      a.selectedSize === b.selectedSize &&
      a.selectedVariant === b.selectedVariant &&
      a.selectedSleeve === b.selectedSleeve &&
      a.customDesignName === b.customDesignName &&
      a.customDesignFile === b.customDesignFile &&
      a.customProductType === b.customProductType
    );
  }
  return (
    a.product.id === b.product.id &&
    a.selectedSize === b.selectedSize &&
    a.selectedVariant === b.selectedVariant &&
    a.selectedSleeve === b.selectedSleeve
  );
}

function normalizeCartItem(item: CartItem): CartItem {
  return {
    ...item,
    cartLineId: item.cartLineId || crypto.randomUUID(),
  };
}

function migrateState(raw: unknown): CartState {
  if (!raw || typeof raw !== 'object') return initialState;
  const o = raw as CartState;
  if (!Array.isArray(o.items)) return initialState;
  const couponCode = o.couponCode ?? null;
  const discount = typeof o.discount === 'number' ? o.discount : 0;
  return {
    items: o.items.map((i: CartItem) => normalizeCartItem(i)),
    couponCode,
    discount: couponCode ? discount : 0,
    couponPaymentMethodScope: couponCode
      ? normalizeCouponPaymentMethodScope((o as any).couponPaymentMethodScope)
      : 'both',
    couponValidatedFor:
      couponCode && ((o as any).couponValidatedFor === 'cod' || (o as any).couponValidatedFor === 'razorpay')
        ? (o as any).couponValidatedFor
        : null,
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const payload = normalizeCartItem(action.payload);
      const existing = state.items.find(i => sameCartLine(i, payload));
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.cartLineId === existing.cartLineId
              ? { ...i, quantity: i.quantity + payload.quantity }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, payload] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.cartLineId !== action.payload) };
    case 'UPDATE_QTY':
      return {
        ...state,
        items: state.items.map(i =>
          i.cartLineId === action.payload.cartLineId
            ? { ...i, quantity: Math.max(1, action.payload.quantity) }
            : i
        ),
      };
    case 'APPLY_COUPON':
      return {
        ...state,
        couponCode: action.payload.code,
        discount: action.payload.discount,
        couponPaymentMethodScope: normalizeCouponPaymentMethodScope(action.payload.paymentMethodScope),
        couponValidatedFor:
          action.payload.validatedFor === 'cod' || action.payload.validatedFor === 'razorpay'
            ? action.payload.validatedFor
            : null,
      };
    case 'CLEAR_COUPON':
      return {
        ...state,
        couponCode: null,
        discount: 0,
        couponPaymentMethodScope: 'both',
        couponValidatedFor: null,
      };
    case 'REPLACE_ITEMS':
      return { ...state, items: action.payload.map(normalizeCartItem) };
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

export type CartItemInput = Omit<CartItem, 'cartLineId'> & { cartLineId?: string };

interface CartContextType {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
  couponPaymentMethodScope: CouponPaymentMethodScope;
  couponValidatedFor: 'cod' | 'razorpay' | null;
  /** Per-line computed unit price (defaults to product.price). */
  unitPriceForItem: (item: CartItem, method?: 'cod' | 'razorpay') => number;
  /** Compute totals for a payment method without changing cart state. */
  totalsForPaymentMethod: (method: 'cod' | 'razorpay') => { subtotal: number; discount: number; total: number };
  addItem: (item: CartItemInput) => void;
  removeItem: (cartLineId: string) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  applyCoupon: (
    code: string,
    discount: number,
    opts?: { paymentMethodScope?: CouponPaymentMethodScope; validatedFor?: 'cod' | 'razorpay' }
  ) => void;
  clearCoupon: () => void;
  clearCart: () => void;
  /** Re-validate cart lines against latest product stock. */
  reconcileWithStock: () => { removed: number; adjusted: number };
  subtotal: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { products } = useProducts();
  const [state, dispatch] = useReducer(cartReducer, initialState, () => {
    try {
      const saved = localStorage.getItem('trendnest-cart');
      return saved ? migrateState(JSON.parse(saved)) : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem('trendnest-cart', JSON.stringify(state));
  }, [state]);

  const subtotal = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const defaultMethodDiscount = state.couponCode && couponScopeAllowsMethod(state.couponPaymentMethodScope, 'cod') ? state.discount : 0;
  const total = Math.max(0, subtotal - defaultMethodDiscount);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products ?? []) m.set(p.id, p);
    return m;
  }, [products]);

  const availableStockFor = useCallback(
    (productId: string, selectedVariant?: string): number => {
      const p = productById.get(String(productId)) || null;
      if (!p) return 0;
      const variantKey = selectedVariant ? String(selectedVariant) : '';
      const vm = (p as any)?.variantModel;
      if (vm?.items?.length && variantKey) {
        const hit = vm.items.find((x: any) => String(x?.key) === variantKey);
        if (hit) return Math.max(0, Number(hit.stock) || 0);
      }
      return Math.max(0, Number((p as any).stock) || 0);
    },
    [productById]
  );

  const unitPriceForItem = useCallback(
    (item: CartItem, method: 'cod' | 'razorpay' = 'cod'): number => {
      const p = item.product as any;
      if (p?.variantModel?.items?.length && item.selectedVariant) {
        const hit = p.variantModel.items.find((x: any) => String(x?.key) === String(item.selectedVariant));
        if (hit) {
          const n =
            method === 'razorpay'
              ? (hit.onlinePrice != null ? Number(hit.onlinePrice) : Number(hit.price))
              : (hit.codPrice != null ? Number(hit.codPrice) : Number(hit.price));
          return Number.isFinite(n) && n >= 0 ? n : 0;
        }
      }
      const n =
        method === 'razorpay'
          ? (p.onlinePrice != null ? Number(p.onlinePrice) : Number(p.price))
          : (p.codPrice != null ? Number(p.codPrice) : Number(p.price));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    },
    []
  );

  const totalsForPaymentMethod = useCallback(
    (method: 'cod' | 'razorpay') => {
      const sub = state.items.reduce((sum, i) => sum + unitPriceForItem(i, method) * i.quantity, 0);
      const effectiveDiscount =
        state.couponCode && couponScopeAllowsMethod(state.couponPaymentMethodScope, method) ? state.discount : 0;
      return { subtotal: sub, discount: effectiveDiscount, total: Math.max(0, sub - effectiveDiscount) };
    },
    [state.items, state.discount, state.couponCode, state.couponPaymentMethodScope, unitPriceForItem]
  );

  const reconcileItems = useCallback(
    (items: CartItem[]) => {
      const removed: CartItem[] = [];
      const adjusted: Array<{ before: CartItem; afterQty: number }> = [];
      const next: CartItem[] = [];

      for (const it of items) {
        const max = availableStockFor(it.product.id, it.selectedVariant);
        if (max <= 0) {
          removed.push(it);
          continue;
        }
        const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const clamped = Math.min(qty, max);
        if (clamped !== qty) adjusted.push({ before: it, afterQty: clamped });
        next.push({ ...it, quantity: clamped });
      }

      return { next, removed, adjusted };
    },
    [availableStockFor]
  );

  const reconcileWithStock = useCallback(() => {
    const { next, removed, adjusted } = reconcileItems(state.items);
    if (removed.length || adjusted.length) {
      dispatch({ type: 'REPLACE_ITEMS', payload: next });
      if (removed.length) toast.message(`${removed.length} item(s) removed — out of stock.`);
      if (adjusted.length) toast.message(`${adjusted.length} item(s) quantity adjusted to available stock.`);
    }
    return { removed: removed.length, adjusted: adjusted.length };
  }, [reconcileItems, state.items]);

  // Validate cart anytime product stock changes (real-time sync).
  useEffect(() => {
    if (!state.items.length) return;
    reconcileWithStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const addItem = (item: CartItemInput) => {
    const desired = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const max = availableStockFor(item.product.id, item.selectedVariant);
    if (max <= 0) {
      toast.error('This item is out of stock.');
      return;
    }
    const qty = Math.min(desired, max);
    if (qty !== desired) toast.message(`Quantity adjusted to ${qty} (available stock).`);
    const payload: CartItem = normalizeCartItem({ ...(item as CartItem), quantity: qty });
    dispatch({ type: 'ADD_ITEM', payload });
    void trackAddToCartEvent({
      productId: String(item.product.id || ''),
      productName: String(item.product.name || ''),
    });
  };

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        couponCode: state.couponCode,
        discount: state.discount,
        couponPaymentMethodScope: state.couponPaymentMethodScope,
        couponValidatedFor: state.couponValidatedFor,
        unitPriceForItem,
        totalsForPaymentMethod,
        addItem,
        removeItem: id => dispatch({ type: 'REMOVE_ITEM', payload: id }),
        updateQuantity: (cartLineId, qty) => {
          const line = state.items.find(x => x.cartLineId === cartLineId);
          if (!line) return;
          const max = availableStockFor(line.product.id, line.selectedVariant);
          if (max <= 0) {
            dispatch({ type: 'REMOVE_ITEM', payload: cartLineId });
            toast.message('Item removed — out of stock.');
            return;
          }
          const nextQty = Math.max(1, Math.min(Math.floor(Number(qty) || 1), max));
          if (nextQty !== qty) toast.message(`Quantity adjusted to ${nextQty} (available stock).`);
          dispatch({ type: 'UPDATE_QTY', payload: { cartLineId, quantity: nextQty } });
        },
        applyCoupon: (code, discount, opts) =>
          dispatch({
            type: 'APPLY_COUPON',
            payload: {
              code,
              discount,
              paymentMethodScope: opts?.paymentMethodScope,
              validatedFor: opts?.validatedFor,
            },
          }),
        clearCoupon: () => dispatch({ type: 'CLEAR_COUPON' }),
        clearCart: () => dispatch({ type: 'CLEAR_CART' }),
        reconcileWithStock,
        subtotal,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
