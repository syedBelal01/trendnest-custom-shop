/**
 * API base: empty in dev (Vite proxies /api → server). In production set VITE_API_BASE_URL.
 */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
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
    res = await fetch(apiUrl('/api/products'));
  } catch {
    throw new ProductsApiError(
      'Cannot reach the API. In the project folder run: npm run dev:api (keep that terminal open), or use npm run dev:full to start both Vite and the API.',
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
    throw new ProductsApiError(
      typeof data.error === 'string' ? data.error : `Request failed (${res.status})`,
      'HTTP'
    );
  }
  return res.json();
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
