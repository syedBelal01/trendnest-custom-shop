import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type StorefrontPaymentMethod = 'cod' | 'razorpay';

type PaymentMethodContextValue = {
  method: StorefrontPaymentMethod;
  setMethod: (m: StorefrontPaymentMethod) => void;
};

const KEY = 'trendnest-payment-method';

const Ctx = createContext<PaymentMethodContextValue | null>(null);

function safeReadStored(): StorefrontPaymentMethod | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === 'cod' || raw === 'razorpay') return raw;
    return null;
  } catch {
    return null;
  }
}

export function PaymentMethodProvider(props: { children: React.ReactNode }) {
  const [method, setMethod] = useState<StorefrontPaymentMethod>(() => safeReadStored() ?? 'cod');

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, method);
    } catch {
      // ignore
    }
  }, [method]);

  const value = useMemo<PaymentMethodContextValue>(() => ({ method, setMethod }), [method]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function usePaymentMethod(): PaymentMethodContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePaymentMethod must be used within PaymentMethodProvider');
  return ctx;
}

