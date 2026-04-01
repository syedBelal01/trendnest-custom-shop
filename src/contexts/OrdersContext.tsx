import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Order, OrderStatus } from '@/types';
import {
  clearAdminApiKey,
  fetchOrdersAdmin,
  getAdminApiKey,
  patchOrderStatusApi,
  setAdminApiKeyInSession,
} from '@/lib/ordersApi';

type OrdersContextValue = {
  orders: Order[];
  ordersLoading: boolean;
  ordersError: string | null;
  /** True if sessionStorage has an admin key (may still be invalid until refresh succeeds). */
  adminKeySet: boolean;
  setAdminApiKey: (key: string) => void;
  clearAdminApiKeyAndOrders: () => void;
  refreshOrders: () => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
};

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [adminKeySet, setAdminKeySet] = useState(() => !!getAdminApiKey());

  const refreshOrders = useCallback(async () => {
    if (!getAdminApiKey()) {
      setOrders([]);
      setOrdersError(null);
      return;
    }
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const list = await fetchOrdersAdmin();
      setOrders(list);
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : 'Failed to load orders');
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminKeySet) {
      setOrders([]);
      setOrdersError(null);
      return;
    }
    void refreshOrders();
  }, [adminKeySet, refreshOrders]);

  const setAdminApiKey = useCallback((key: string) => {
    const t = key.trim();
    setAdminApiKeyInSession(t);
    setAdminKeySet(!!t);
  }, []);

  const clearAdminApiKeyAndOrders = useCallback(() => {
    clearAdminApiKey();
    setAdminKeySet(false);
    setOrders([]);
    setOrdersError(null);
  }, []);

  const updateOrderStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      await patchOrderStatusApi(id, status);
      await refreshOrders();
    },
    [refreshOrders]
  );

  return (
    <OrdersContext.Provider
      value={{
        orders,
        ordersLoading,
        ordersError,
        adminKeySet,
        setAdminApiKey,
        clearAdminApiKeyAndOrders,
        refreshOrders,
        updateOrderStatus,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used within OrdersProvider');
  return ctx;
}
