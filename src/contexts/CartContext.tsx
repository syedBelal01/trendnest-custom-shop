import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { CartItem, Product } from '@/types';
import { toast } from 'sonner';

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QTY'; payload: { productId: string; quantity: number } }
  | { type: 'APPLY_COUPON'; payload: { code: string; discount: number } }
  | { type: 'CLEAR_CART' };

const initialState: CartState = { items: [], couponCode: null, discount: 0 };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        i => i.product.id === action.payload.product.id &&
             i.selectedSize === action.payload.selectedSize &&
             i.selectedVariant === action.payload.selectedVariant
      );
      if (existing) {
        return { ...state, items: state.items.map(i =>
          i === existing ? { ...i, quantity: i.quantity + action.payload.quantity } : i
        )};
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.product.id !== action.payload) };
    case 'UPDATE_QTY':
      return { ...state, items: state.items.map(i =>
        i.product.id === action.payload.productId ? { ...i, quantity: Math.max(1, action.payload.quantity) } : i
      )};
    case 'APPLY_COUPON':
      return { ...state, couponCode: action.payload.code, discount: action.payload.discount };
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

interface CartContextType {
  items: CartItem[];
  couponCode: string | null;
  discount: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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
      return saved ? JSON.parse(saved) : initialState;
    } catch { return initialState; }
  });

  useEffect(() => {
    localStorage.setItem('trendnest-cart', JSON.stringify(state));
  }, [state]);

  const subtotal = state.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const total = Math.max(0, subtotal - state.discount);
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const addItem = (item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
    toast.success(`${item.product.name} added to cart`);
  };

  return (
    <CartContext.Provider value={{
      items: state.items, couponCode: state.couponCode, discount: state.discount,
      addItem, removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', payload: id }),
      updateQuantity: (id, qty) => dispatch({ type: 'UPDATE_QTY', payload: { productId: id, quantity: qty } }),
      applyCoupon: (code, discount) => dispatch({ type: 'APPLY_COUPON', payload: { code, discount } }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      subtotal, total, itemCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
