import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { CartItem } from '@/types';
import { toast } from 'sonner';

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { cartLineId: string; quantity: number } }
  | { type: 'APPLY_COUPON'; payload: { code: string; discount: number } }
  | { type: 'CLEAR_CART' };

const initialState: CartState = { items: [], couponCode: null, discount: 0 };

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
  return {
    items: o.items.map((i: CartItem) => normalizeCartItem(i)),
    couponCode: o.couponCode ?? null,
    discount: typeof o.discount === 'number' ? o.discount : 0,
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
      return { ...state, couponCode: action.payload.code, discount: action.payload.discount };
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
  /** Per-line computed unit price (defaults to product.price). */
  unitPriceForItem: (item: CartItem, method?: 'cod' | 'razorpay') => number;
  /** Compute totals for a payment method without changing cart state. */
  totalsForPaymentMethod: (method: 'cod' | 'razorpay') => { subtotal: number; total: number };
  addItem: (item: CartItemInput) => void;
  removeItem: (cartLineId: string) => void;
  updateQuantity: (cartLineId: string, quantity: number) => void;
  applyCoupon: (code: string, discount: number) => void;
  clearCart: () => void;
  subtotal: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
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
  const total = Math.max(0, subtotal - state.discount);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const unitPriceForItem = (item: CartItem, method: 'cod' | 'razorpay' = 'cod'): number => {
    const p = item.product as any;
    // If selectedVariant is a variantModel key, use that row's online/cod price.
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
  };

  const totalsForPaymentMethod = (method: 'cod' | 'razorpay') => {
    const sub = state.items.reduce((sum, i) => sum + unitPriceForItem(i, method) * i.quantity, 0);
    return { subtotal: sub, total: Math.max(0, sub - state.discount) };
  };

  const addItem = (item: CartItemInput) => {
    const payload: CartItem = normalizeCartItem(item as CartItem);
    dispatch({ type: 'ADD_ITEM', payload });
    toast.success(`${item.product.name} added to cart`);
  };

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        couponCode: state.couponCode,
        discount: state.discount,
        unitPriceForItem,
        totalsForPaymentMethod,
        addItem,
        removeItem: id => dispatch({ type: 'REMOVE_ITEM', payload: id }),
        updateQuantity: (cartLineId, qty) =>
          dispatch({ type: 'UPDATE_QTY', payload: { cartLineId, quantity: qty } }),
        applyCoupon: (code, discount) => dispatch({ type: 'APPLY_COUPON', payload: { code, discount } }),
        clearCart: () => dispatch({ type: 'CLEAR_CART' }),
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
