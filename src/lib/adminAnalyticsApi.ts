import { apiUrl } from '@/lib/api';

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem('trendnest-admin-api-key');
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export type VisitorsAnalytics = {
  totalUniqueVisitors: number;
  addToCart: {
    totalEvents: number;
    uniqueVisitors: number;
    topProducts: Array<{
      productId: string;
      productName: string;
      totalAdds: number;
      uniqueVisitors: number;
    }>;
  };
  checkout: {
    totalVisits: number;
    uniqueVisitors: number;
  };
  updatedAt?: string;
};

export async function fetchVisitorsAnalyticsApi(): Promise<VisitorsAnalytics> {
  const res = await fetch(apiUrl('/api/admin/analytics/visitors'), { headers: adminHeaders(), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load visitor analytics');
  }
  const addToCartRaw = data.addToCart && typeof data.addToCart === 'object' ? data.addToCart : {};
  const checkoutRaw = data.checkout && typeof data.checkout === 'object' ? data.checkout : {};
  const topProductsRaw = Array.isArray(addToCartRaw.topProducts) ? addToCartRaw.topProducts : [];
  return {
    totalUniqueVisitors: Number(data.totalUniqueVisitors || 0),
    addToCart: {
      totalEvents: Number(addToCartRaw.totalEvents || 0),
      uniqueVisitors: Number(addToCartRaw.uniqueVisitors || 0),
      topProducts: topProductsRaw.map((row: any) => ({
        productId: String(row?.productId || ''),
        productName: String(row?.productName || row?.productId || ''),
        totalAdds: Number(row?.totalAdds || 0),
        uniqueVisitors: Number(row?.uniqueVisitors || 0),
      })),
    },
    checkout: {
      totalVisits: Number(checkoutRaw.totalVisits || 0),
      uniqueVisitors: Number(checkoutRaw.uniqueVisitors || 0),
    },
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
  };
}

