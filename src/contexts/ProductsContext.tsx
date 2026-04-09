import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Product } from '@/types';
import { initialProducts } from '@/data/mockData';
import {
  fetchProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  ProductsApiError,
} from '@/lib/api';
import { fetchReviewsSummaryApi, type RatingSummary } from '@/lib/reviewsSummaryApi';

export type ProductApiIssue = {
  code: ProductsApiError['code'];
  message: string;
};

type ProductsContextValue = {
  products: Product[];
  ratingSummary: Record<string, RatingSummary>;
  loading: boolean;
  apiAvailable: boolean;
  /** Why the API is not usable (null when connected). */
  apiIssue: ProductApiIssue | null;
  refreshProducts: () => Promise<void>;
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(() => [...initialProducts]);
  const [ratingSummary, setRatingSummary] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [apiIssue, setApiIssue] = useState<ProductApiIssue | null>(null);

  const refreshProducts = useCallback(async () => {
    try {
      const list = await fetchProductsApi();
      setProducts(list);
      try {
        const summary = await fetchReviewsSummaryApi(list.map(p => p.id));
        setRatingSummary(summary);
      } catch {
        setRatingSummary({});
      }
      setApiAvailable(true);
      setApiIssue(null);
    } catch (e) {
      setApiAvailable(false);
      setProducts([...initialProducts]);
      setRatingSummary({});
      if (e instanceof ProductsApiError) {
        setApiIssue({ code: e.code, message: e.message });
      } else {
        setApiIssue({
          code: 'HTTP',
          message: e instanceof Error ? e.message : 'Failed to load products',
        });
      }
    }
  }, []);

  // Allow other parts of the app (checkout/admin) to request an immediate refresh.
  useEffect(() => {
    const on = () => { void refreshProducts(); };
    window.addEventListener('trendnest:products-updated', on);
    return () => window.removeEventListener('trendnest:products-updated', on);
  }, [refreshProducts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchProductsApi();
        if (!cancelled) {
          setProducts(list);
          try {
            const summary = await fetchReviewsSummaryApi(list.map(p => p.id));
            if (!cancelled) setRatingSummary(summary);
          } catch {
            if (!cancelled) setRatingSummary({});
          }
          setApiAvailable(true);
          setApiIssue(null);
        }
      } catch (e) {
        if (!cancelled) {
          setApiAvailable(false);
          setProducts([...initialProducts]);
          setRatingSummary({});
          if (e instanceof ProductsApiError) {
            setApiIssue({ code: e.code, message: e.message });
          } else {
            setApiIssue({
              code: 'HTTP',
              message: e instanceof Error ? e.message : 'Failed to load products',
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addProduct = useCallback(
    async (p: Product) => {
      if (!apiAvailable) {
        setProducts(prev => [...prev, p]);
        return;
      }
      const saved = await createProductApi(p);
      setProducts(prev => [...prev, saved]);
    },
    [apiAvailable]
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      if (!apiAvailable) {
        setProducts(prev => prev.map(x => (x.id === id ? { ...x, ...patch } as Product : x)));
        return;
      }
      const { id: _drop, ...body } = patch as Partial<Product> & { id?: string };
      void _drop;
      const saved = await updateProductApi(id, body);
      setProducts(prev => prev.map(x => (x.id === id ? saved : x)));
    },
    [apiAvailable]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (!apiAvailable) {
        setProducts(prev => prev.filter(x => x.id !== id));
        return;
      }
      await deleteProductApi(id);
      setProducts(prev => prev.filter(x => x.id !== id));
    },
    [apiAvailable]
  );

  return (
    <ProductsContext.Provider
      value={{
        products,
        ratingSummary,
        loading,
        apiAvailable,
        apiIssue,
        refreshProducts,
        addProduct,
        updateProduct,
        deleteProduct,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider');
  return ctx;
}
