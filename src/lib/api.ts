/**
 * API base:
 * - Dev: empty → Vite proxies /api to the local server (vite.config.ts).
 * - Production: VITE_API_BASE_URL from .env.production or the host (e.g. Vercel), else deployed Render API below.
 */
const PRODUCTION_API_BASE = 'https://trendnest-custom-shop.onrender.com';

export function apiUrl(path: string): string {
  let base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '').trim() ?? '';
  let forceSameOrigin = false;
  // Prerender runs the app on a localhost server (e.g. http://localhost:8001).
  // Force same-origin `/api` so Vite's proxy can forward without CORS blocks.
  if (!import.meta.env.DEV) {
    try {
      const loc = (globalThis as any)?.location;
      const host = String(loc?.hostname || '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1') {
        base = '';
        forceSameOrigin = true;
      }
    } catch {
      // ignore
    }
  }
  // Use Render when not in Vite dev (covers production and preview); DEV is always true for vite / vite dev.
  if (!base && !import.meta.env.DEV && !forceSameOrigin) base = PRODUCTION_API_BASE;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export type PublicHealthResponse = {
  ok?: boolean;
  mongo?: boolean;
  cloudinary?: boolean;
  allowCheckoutWithoutShippingQuote?: boolean;
};

const PUBLIC_HEALTH_TTL_MS = 60_000;
let publicHealthCache: { expiresAt: number; data: PublicHealthResponse } | null = null;

const STRICT_HEALTH_FALLBACK: PublicHealthResponse = {
  ok: false,
  allowCheckoutWithoutShippingQuote: false,
};

/**
 * Unauthenticated; used for checkout relaxed-mode gating. Cached briefly; any fetch failure defaults to strict (no relaxed checkout).
 */
export async function fetchPublicHealthApi(): Promise<PublicHealthResponse> {
  const now = Date.now();
  if (publicHealthCache && publicHealthCache.expiresAt > now) {
    return publicHealthCache.data;
  }
  try {
    const res = await fetch(apiUrl('/api/health'));
    const raw = (await res.json().catch(() => ({}))) as PublicHealthResponse;
    const data: PublicHealthResponse = {
      ...raw,
      allowCheckoutWithoutShippingQuote: !!raw.allowCheckoutWithoutShippingQuote,
    };
    publicHealthCache = { expiresAt: now + PUBLIC_HEALTH_TTL_MS, data };
    return data;
  } catch {
    publicHealthCache = { expiresAt: now + PUBLIC_HEALTH_TTL_MS, data: STRICT_HEALTH_FALLBACK };
    return STRICT_HEALTH_FALLBACK;
  }
}

export async function uploadProductImage(fileOrBlob: Blob, filename = 'product.jpg'): Promise<string> {
  const fd = new FormData();
  fd.append('image', fileOrBlob, filename);
  const res = await fetch(apiUrl('/api/upload/image'), { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Image upload failed');
  }
  if (!data.url) throw new Error('No image URL returned from server');
  return data.url as string;
}

export async function uploadCustomDesign(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('design', file, file.name);
  const res = await fetch(apiUrl('/api/upload/design'), { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Design upload failed');
  }
  if (!data.url) throw new Error('No design URL returned from server');
  return data.url as string;
}

export class ProductsApiError extends Error {
  constructor(
    message: string,
    public readonly code: 'NETWORK' | 'DATABASE_UNAVAILABLE' | 'HTTP'
  ) {
    super(message);
    this.name = 'ProductsApiError';
  }
}

export async function fetchProductsApi(): Promise<import('@/types').Product[]> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/products?t=${Date.now()}`), productFetchInit);
  } catch {
    throw new ProductsApiError(
      import.meta.env.DEV
        ? 'Cannot reach the API. Run npm run dev:api or npm run dev:full so the local server is up (port 5050).'
        : 'Cannot reach the API. Check your network and that the API is reachable (VITE_API_BASE_URL / Render).',
      'NETWORK'
    );
  }

  if (res.status === 503) {
    const data = await res.json().catch(() => ({}));
    const serverMsg = typeof data.error === 'string' ? data.error : '';
    throw new ProductsApiError(
      serverMsg ||
        'MongoDB is not connected. Check MONGODB_URI in your .env file (Atlas IP access list: allow your IP or 0.0.0.0/0 for testing), then restart the API terminal.',
      'DATABASE_UNAVAILABLE'
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const serverMsg = typeof data.error === 'string' ? data.error : '';
    let msg = serverMsg || `Request failed (${res.status})`;
    // Vite proxy returns 500/502/504 with no JSON body when nothing listens on 127.0.0.1:5050
    if (
      import.meta.env.DEV &&
      !serverMsg &&
      (res.status === 500 || res.status === 502 || res.status === 504)
    ) {
      msg = `Local API is not running (Vite proxy got HTTP ${res.status}). In another terminal run npm run dev:api, or use npm run dev:full to start the web app and API together (API on port 5050).`;
    }
    throw new ProductsApiError(msg, 'HTTP');
  }
  return res.json();
}

const productFetchInit: RequestInit = {
  cache: 'no-store',
};

/** Single product by id (includes `specifications` when set in MongoDB). */
export async function fetchProductByIdApi(id: string): Promise<import('@/types').Product | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(
      apiUrl(`/api/products/${encodeURIComponent(trimmed)}?t=${Date.now()}`),
      productFetchInit
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as import('@/types').Product | null;
    return data?.id ? data : null;
  } catch {
    return null;
  }
}

export async function createProductApi(product: import('@/types').Product): Promise<import('@/types').Product> {
  const res = await fetch(apiUrl('/api/products'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save product');
  if (!data?.id) throw new Error('Invalid product response from server (missing id)');
  return data;
}

export async function updateProductApi(
  id: string,
  patch: Partial<import('@/types').Product>
): Promise<import('@/types').Product> {
  const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update product');
  if (!data?.id) throw new Error('Invalid product response from server (missing id)');
  return data;
}

export async function deleteProductApi(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`), { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete product');
  }
}

export const DEFAULT_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1553062407-98d43420e9e7?w=600';

type EnsureImagesOpts = { defaultIfEmpty?: boolean };

/** Upload data: URLs to Cloudinary; keep https as-is. */
export async function ensureImageUrlList(
  images: string[] | undefined,
  opts?: EnsureImagesOpts
): Promise<string[]> {
  const defaultIfEmpty = opts?.defaultIfEmpty !== false;
  const list = (images ?? []).map(s => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  if (!list.length) return defaultIfEmpty ? [DEFAULT_PRODUCT_IMAGE] : [];

  const out: string[] = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.startsWith('data:')) {
      const blob = await (await fetch(s)).blob();
      const url = await uploadProductImage(blob, `product-${Date.now()}-${i}.jpg`);
      out.push(url);
    } else {
      out.push(s);
    }
  }
  return out.length ? out : defaultIfEmpty ? [DEFAULT_PRODUCT_IMAGE] : [];
}

/** Product-level image list: empty becomes one default photo. */
export async function ensureProductImageUrls(images: string[] | undefined): Promise<string[]> {
  return ensureImageUrlList(images, { defaultIfEmpty: true });
}

export type VariantOptionInput = { name: string; images: string[] };

/** Upload images inside each variant; variants with no images stay empty. */
export async function ensureVariantOptionsImageUrls(
  options: VariantOptionInput[]
): Promise<VariantOptionInput[]> {
  const out: VariantOptionInput[] = [];
  for (const o of options) {
    const images = await ensureImageUrlList(o.images, { defaultIfEmpty: false });
    out.push({ name: o.name, images });
  }
  return out;
}
