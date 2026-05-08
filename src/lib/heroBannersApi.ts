import { apiUrl } from '@/lib/api';
import type {
  HeroBannerSettings,
  HeroFirstSlideMode,
  Product,
  SaleBanner,
  SaleBannerStatus,
  SaleBannerTheme,
} from '@/types';

function saleSlugify(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem('trendnest-admin-api-key');
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

function asDateIso(input: unknown): string {
  const d = new Date(String(input ?? ''));
  if (!Number.isFinite(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function normalizeTheme(input: unknown): SaleBannerTheme {
  const v = String(input ?? '').trim().toLowerCase();
  if (v === 'normal') return 'default';
  if (v === 'winter' || v === 'summer' || v === 'eid' || v === 'holi' || v === 'diwali' || v === 'flash') {
    return v;
  }
  return 'default';
}

function normalizeStatus(input: unknown): SaleBannerStatus {
  const v = String(input ?? '').trim().toLowerCase();
  if (v === 'live' || v === 'disabled' || v === 'ended') return v;
  return 'draft';
}

function normalizeFirstSlideMode(input: unknown): HeroFirstSlideMode {
  const v = String(input ?? '').trim().toLowerCase();
  if (v === 'default' || v === 'banner') return v;
  return 'auto';
}

function normalizeHeroBannerSettings(raw: any): HeroBannerSettings {
  const mode = normalizeFirstSlideMode(raw?.firstSlideMode);
  const firstBannerId = String(raw?.firstBannerId ?? '').trim();
  return {
    firstSlideMode: mode,
    firstBannerId: mode === 'banner' ? firstBannerId : '',
    updatedAt: raw?.updatedAt ? asDateIso(raw.updatedAt) : undefined,
  };
}

function normalizeSaleBanner(raw: any): SaleBanner {
  return {
    id: String(raw?.id ?? ''),
    slug: String(raw?.slug ?? '').trim(),
    title: String(raw?.title ?? ''),
    subtitle: String(raw?.subtitle ?? ''),
    bannerText: String(raw?.bannerText ?? ''),
    discountText: String(raw?.discountText ?? ''),
    desktopImage: String(raw?.desktopImage ?? ''),
    mobileImage: String(raw?.mobileImage ?? ''),
    ctaText: String(raw?.ctaText ?? ''),
    ctaLink: String(raw?.ctaLink ?? ''),
    theme: normalizeTheme(raw?.theme),
    startDate: asDateIso(raw?.startDate),
    endDate: asDateIso(raw?.endDate),
    status: normalizeStatus(raw?.status),
    priority: Number.isFinite(Number(raw?.priority)) ? Math.floor(Number(raw.priority)) : 100,
    targetCategory: String(raw?.targetCategory ?? ''),
    targetProductIds: Array.isArray(raw?.targetProductIds) ? raw.targetProductIds.map((x: unknown) => String(x)).filter(Boolean) : [],
    selectedProducts: Array.isArray(raw?.selectedProducts)
      ? raw.selectedProducts.map((x: unknown) => String(x)).filter(Boolean)
      : Array.isArray(raw?.targetProductIds)
        ? raw.targetProductIds.map((x: unknown) => String(x)).filter(Boolean)
        : [],
    isActive: !!raw?.isActive,
    createdAt: raw?.createdAt ? asDateIso(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? asDateIso(raw.updatedAt) : undefined,
  };
}

export type SaleBannerMutationInput = {
  slug?: string;
  title: string;
  subtitle?: string;
  bannerText?: string;
  discountText?: string;
  desktopImage: string;
  mobileImage?: string;
  ctaText?: string;
  ctaLink?: string;
  theme: SaleBannerTheme;
  startDate: string;
  endDate: string;
  status: SaleBannerStatus;
  priority: number;
  targetCategory?: string;
  targetProductIds?: string[];
};

export type SaleBannerPatchInput = Partial<SaleBannerMutationInput>;
export type HeroBannerSettingsInput = {
  firstSlideMode: HeroFirstSlideMode;
  firstBannerId?: string;
};

export type AdminHeroBannersResponse = {
  banners: SaleBanner[];
  settings: HeroBannerSettings;
  supportsSettingsApi: boolean;
};

export type ActiveHeroBannersResponse = {
  banners: SaleBanner[];
  settings: HeroBannerSettings;
};

export type PublicSaleDetailsResponse = {
  sale: SaleBanner;
  products: Product[];
  state: 'live' | 'scheduled' | 'ended' | 'draft' | 'disabled';
};

function normalizePublicSaleState(input: unknown): PublicSaleDetailsResponse['state'] {
  const v = String(input ?? '').trim().toLowerCase();
  if (v === 'live' || v === 'scheduled' || v === 'ended' || v === 'draft' || v === 'disabled') return v;
  return 'draft';
}

async function fetchProductsForSaleFallback(
  selectedProductIds: string[],
  targetCategory?: string
): Promise<Product[]> {
  try {
    const res = await fetch(apiUrl(`/api/products?t=${Date.now()}`), { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => [])) as Product[];
    const products = Array.isArray(data) ? data : [];

    if (selectedProductIds.length > 0) {
      const byId = new Map(products.map((p) => [String((p as Product)?.id || '').trim(), p]));
      return selectedProductIds.map((id) => byId.get(id)).filter((p): p is Product => !!p);
    }

    const category = String(targetCategory || '').trim().toLowerCase();
    if (!category) return [];
    return products.filter((p) => String((p as Product)?.category || '').trim().toLowerCase() === category);
  } catch {
    return [];
  }
}

async function fetchPublicSaleFallbackByActiveBanner(slug: string): Promise<PublicSaleDetailsResponse | null> {
  const targetSlug = saleSlugify(slug);
  if (!targetSlug) return null;

  const active = await fetchActiveHeroBannersWithSettingsApi();
  const sale = active.banners.find((banner) => {
    const candidate = saleSlugify(banner.slug || banner.title || banner.id);
    return candidate === targetSlug;
  });
  if (!sale) return null;

  const selectedProductIds = Array.isArray(sale.selectedProducts) && sale.selectedProducts.length > 0
    ? sale.selectedProducts.map((x) => String(x).trim()).filter(Boolean)
    : Array.isArray(sale.targetProductIds)
      ? sale.targetProductIds.map((x) => String(x).trim()).filter(Boolean)
      : [];

  const products = await fetchProductsForSaleFallback(selectedProductIds, sale.targetCategory);
  return {
    sale,
    products,
    state: sale.isActive ? 'live' : 'draft',
  };
}

export async function listAdminHeroBannersApi(): Promise<SaleBanner[]> {
  const data = await fetchAdminHeroBannersWithSettingsApi();
  return data.banners;
}

export async function fetchAdminHeroBannersWithSettingsApi(): Promise<AdminHeroBannersResponse> {
  const res = await fetch(apiUrl('/api/admin/hero-banners'), { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load hero banners');
  const supportsSettingsApi =
    !!data &&
    typeof data === 'object' &&
    Object.prototype.hasOwnProperty.call(data, 'settings');
  return {
    banners: Array.isArray(data?.banners) ? data.banners.map(normalizeSaleBanner) : [],
    settings: normalizeHeroBannerSettings(data?.settings || {}),
    supportsSettingsApi,
  };
}

export async function fetchAdminHeroBannerSettingsApi(): Promise<HeroBannerSettings> {
  const res = await fetch(apiUrl('/api/admin/hero-banners/settings'), { headers: adminHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load hero banner settings');
  return normalizeHeroBannerSettings(data?.settings || {});
}

export async function updateHeroBannerSettingsApi(input: HeroBannerSettingsInput): Promise<HeroBannerSettings> {
  const res = await fetch(apiUrl('/api/admin/hero-banners/settings'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify({
      firstSlideMode: normalizeFirstSlideMode(input?.firstSlideMode),
      firstBannerId: String(input?.firstBannerId ?? '').trim(),
    }),
  });
  if (res.status === 404) {
    throw new Error('First-slide settings API is unavailable on this backend. Restart/deploy latest server code.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update hero banner settings');
  return normalizeHeroBannerSettings(data?.settings || {});
}

export async function createHeroBannerApi(input: SaleBannerMutationInput): Promise<SaleBanner> {
  const res = await fetch(apiUrl('/api/admin/hero-banners'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create hero banner');
  return normalizeSaleBanner(data?.banner);
}

export async function updateHeroBannerApi(id: string, patch: SaleBannerPatchInput): Promise<SaleBanner> {
  const res = await fetch(apiUrl(`/api/admin/hero-banners/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update hero banner');
  return normalizeSaleBanner(data?.banner);
}

export async function deleteHeroBannerApi(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/hero-banners/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete hero banner');
  }
}

export async function listActiveHeroBannersApi(): Promise<SaleBanner[]> {
  const data = await fetchActiveHeroBannersWithSettingsApi();
  return data.banners;
}

export async function fetchActiveHeroBannersWithSettingsApi(): Promise<ActiveHeroBannersResponse> {
  const res = await fetch(apiUrl('/api/hero-banners/active'), { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load active hero banners');
  return {
    banners: Array.isArray(data?.banners) ? data.banners.map(normalizeSaleBanner) : [],
    settings: normalizeHeroBannerSettings(data?.settings || {}),
  };
}

export async function fetchPublicSaleBySlugApi(slug: string): Promise<PublicSaleDetailsResponse> {
  const trimmed = String(slug || '').trim();
  if (!trimmed) throw new Error('Missing sale slug');
  const res = await fetch(apiUrl(`/api/sales/${encodeURIComponent(trimmed)}`), { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Compatibility fallback: older API builds may not have /api/sales/:slug yet.
    if (res.status === 404) {
      const fallback = await fetchPublicSaleFallbackByActiveBanner(trimmed);
      if (fallback) return fallback;
    }
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load sale');
  }
  return {
    sale: normalizeSaleBanner(data?.sale || {}),
    products: Array.isArray(data?.products) ? (data.products as Product[]) : [],
    state: normalizePublicSaleState(data?.state),
  };
}
