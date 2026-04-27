import { apiUrl } from '@/lib/api';

function adminHeaders(): HeadersInit {
  const key = sessionStorage.getItem('trendnest-admin-api-key');
  const h: Record<string, string> = {};
  if (key) h['X-Admin-Key'] = key;
  return h;
}

export type VisitorsAnalytics = {
  totalUniqueVisitors: number;
  updatedAt?: string;
};

export async function fetchVisitorsAnalyticsApi(): Promise<VisitorsAnalytics> {
  const res = await fetch(apiUrl('/api/admin/analytics/visitors'), { headers: adminHeaders(), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load visitor analytics');
  }
  return {
    totalUniqueVisitors: Number(data.totalUniqueVisitors || 0),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
  };
}

