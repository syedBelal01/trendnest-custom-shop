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

function normalizeSoapDispenserTypos(text: unknown): string {
  return String(text ?? '').replace(/\bshop\s*dispenser\b/gi, 'Soap Dispenser');
}

const LEGACY_PRODUCT_IMAGE_URL = 'https://res.cloudinary.com/diclcqwnm/image/upload/v1778159066/';
const REPLACEMENT_PRODUCT_IMAGE_URL =
  'https://res.cloudinary.com/diclcqwnm/image/upload/v1778159071/trendnest/products/pbddeuehzcxxhwg9b1em.jpg';

function normalizeLegacyProductImageUrl(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  return s === LEGACY_PRODUCT_IMAGE_URL ? REPLACEMENT_PRODUCT_IMAGE_URL : s;
}

function normalizeProductTypos(product: Product): Product {
  const category = String(product.category || 'fashion') as Product['category'];
  const categories = Array.isArray(product.categories)
    ? Array.from(new Set([category, ...product.categories].map((c) => String(c).trim()).filter(Boolean))) as Product['categories']
    : [category];
  const next: Product = {
    ...product,
    category,
    categories,
    name: normalizeSoapDispenserTypos(product.name),
    subcategory: product.subcategory != null ? normalizeSoapDispenserTypos(product.subcategory) : product.subcategory,
    images: Array.isArray(product.images)
      ? product.images.map((u) => normalizeLegacyProductImageUrl(u)).filter(Boolean)
      : product.images,
  };
  if (Array.isArray(next.variantOptions)) {
    next.variantOptions = next.variantOptions.map((opt) => ({
      ...opt,
      images: Array.isArray(opt.images) ? opt.images.map((u) => normalizeLegacyProductImageUrl(u)).filter(Boolean) : [],
    }));
  }
  if (next.variantModel?.items?.length) {
    next.variantModel = {
      ...next.variantModel,
      items: next.variantModel.items.map((it) => ({
        ...it,
        displayName: it.displayName != null ? normalizeSoapDispenserTypos(it.displayName) : it.displayName,
        previewImage: it.previewImage != null ? normalizeLegacyProductImageUrl(it.previewImage) : it.previewImage,
        image: it.image != null ? normalizeLegacyProductImageUrl(it.image) : it.image,
        images: Array.isArray(it.images) ? it.images.map((u) => normalizeLegacyProductImageUrl(u)).filter(Boolean) : it.images,
      })),
    };
  }
  return next;
}

type ProductsContextValue = {
  products: Product[];
  ratingSummary: Record<string, RatingSummary>;
  loading: boolean;
  apiAvailable: boolean;
  /** Why the API is not usable (null when connected). */
  apiIssue: ProductApiIssue | null;
  refreshProducts: () => Promise<void>;
  refreshRatingSummary: (productIds?: string[]) => Promise<void>;
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
};

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined);

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [ratingSummary, setRatingSummary] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(false);
  const [apiIssue, setApiIssue] = useState<ProductApiIssue | null>(null);

  const refreshRatingSummary = useCallback(
    async (productIds?: string[]) => {
      if (!apiAvailable) {
        setRatingSummary({});
        return;
      }
      const ids =
        productIds && productIds.length
          ? productIds
          : products.map((p) => p.id);
      try {
        const summary = await fetchReviewsSummaryApi(ids);
        setRatingSummary((prev) => ({ ...prev, ...summary }));
      } catch {
        // Keep previous summary; ratings are non-critical UI.
      }
    },
    [apiAvailable, products]
  );

  const refreshProducts = useCallback(async () => {
    try {
      const list = await fetchProductsApi();
      setProducts(list.map(normalizeProductTypos));
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
      setProducts(initialProducts.map(normalizeProductTypos));
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

  // Keep stock reasonably fresh in the storefront (prevents stale "In Stock" state).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshProducts();
    };
    document.addEventListener('visibilitychange', onVis);
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshProducts();
    }, 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(t);
    };
  }, [refreshProducts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchProductsApi();
        if (!cancelled) {
          setProducts(list.map(normalizeProductTypos));
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
          setProducts(initialProducts.map(normalizeProductTypos));
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
        refreshRatingSummary,
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
