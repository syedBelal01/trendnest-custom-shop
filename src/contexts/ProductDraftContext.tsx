import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createProductDraftApi, fetchProductDraftApi, patchProductDraftApi, type ProductDraft } from '@/lib/adminDraftsApi';

type DraftContextValue = {
  draft: ProductDraft | null;
  loading: boolean;
  error: string | null;
  /** Update local draft state immediately and schedule autosave PATCH. */
  updateDraftLocal: (patch: Partial<ProductDraft>) => void;
  /** Flush pending autosave immediately. */
  flush: () => Promise<void>;
  /** Create a new draft on the server and load it. */
  createNew: () => Promise<ProductDraft>;
  /** Reload draft from server. */
  reload: () => Promise<void>;
};

const DraftContext = createContext<DraftContextValue | null>(null);

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Draft updates come in quickly (SKU/price/stock edits + variant image uploads).
 * Deep-merge nested objects so we never drop fields like `variants.items[].images`.
 */
function mergeDraftPatch(prev: ProductDraft, patch: Partial<ProductDraft>): ProductDraft {
  const next: ProductDraft = { ...prev, ...(patch as ProductDraft) };

  if (patch.details !== undefined && isPlainObject(prev.details) && isPlainObject(patch.details)) {
    next.details = { ...(prev.details as Record<string, unknown>), ...(patch.details as Record<string, unknown>) };
  }

  if (patch.variants !== undefined && isPlainObject(prev.variants) && isPlainObject(patch.variants)) {
    next.variants = { ...(prev.variants as Record<string, unknown>), ...(patch.variants as Record<string, unknown>) };
  }

  if (patch.images !== undefined) {
    const prevImages = prev.images ?? { items: [], primaryIndex: 0 };
    const patchImages = patch.images as Partial<ProductDraft['images']> | undefined;
    next.images = {
      items: Array.isArray(patchImages?.items) ? patchImages!.items : prevImages.items,
      primaryIndex: typeof patchImages?.primaryIndex === 'number' ? patchImages.primaryIndex : prevImages.primaryIndex,
    };
  }

  return next;
}

function mergePendingPatch(prev: Partial<ProductDraft> | null, patch: Partial<ProductDraft>): Partial<ProductDraft> {
  if (!prev) return patch;
  const out: Partial<ProductDraft> = { ...prev, ...patch };

  if (patch.details !== undefined && isPlainObject(prev.details) && isPlainObject(patch.details)) {
    out.details = { ...(prev.details as Record<string, unknown>), ...(patch.details as Record<string, unknown>) };
  }

  if (patch.variants !== undefined && isPlainObject(prev.variants) && isPlainObject(patch.variants)) {
    out.variants = { ...(prev.variants as Record<string, unknown>), ...(patch.variants as Record<string, unknown>) };
  }

  if (patch.images !== undefined) {
    const prevImages = prev.images ?? { items: [], primaryIndex: 0 };
    const patchImages = patch.images as Partial<ProductDraft['images']> | undefined;
    out.images = {
      items: Array.isArray(patchImages?.items) ? patchImages!.items : prevImages.items,
      primaryIndex: typeof patchImages?.primaryIndex === 'number' ? patchImages.primaryIndex : prevImages.primaryIndex,
    } as ProductDraft['images'];
  }

  return out;
}

export function ProductDraftProvider(props: { draftId: string; children: React.ReactNode }) {
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingRef = useRef<Partial<ProductDraft> | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchProductDraftApi(props.draftId);
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load draft');
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [props.draftId]);

  useEffect(() => {
    void load();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [load]);

  const flush = useCallback(async () => {
    const patch = pendingRef.current;
    if (!patch) return;
    pendingRef.current = null;
    if (!draft) return;
    try {
      const next = await patchProductDraftApi(draft.draftId, patch);
      setDraft(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save draft');
      throw e;
    }
  }, [draft]);

  const schedule = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush().catch(() => {
        // Keep local state; error is exposed via `error`.
      });
    }, 600);
  }, [flush]);

  const updateDraftLocal = useCallback(
    (patch: Partial<ProductDraft>) => {
      setDraft(prev => (prev ? mergeDraftPatch(prev, patch) : prev));
      pendingRef.current = mergePendingPatch(pendingRef.current, patch);
      setError(null);
      schedule();
    },
    [schedule]
  );

  const createNew = useCallback(async () => {
    const d = await createProductDraftApi();
    setDraft(d);
    setError(null);
    setLoading(false);
    return d;
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const value = useMemo(
    () => ({ draft, loading, error, updateDraftLocal, flush, createNew, reload }),
    [draft, loading, error, updateDraftLocal, flush, createNew, reload]
  );

  return <DraftContext.Provider value={value}>{props.children}</DraftContext.Provider>;
}

export function useProductDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useProductDraft must be used within ProductDraftProvider');
  return ctx;
}

