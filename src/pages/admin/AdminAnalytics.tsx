import { useEffect, useState } from 'react';
import { fetchVisitorsAnalyticsApi, type VisitorsAnalytics } from '@/lib/adminAnalyticsApi';
import { toast } from 'sonner';

export default function AdminAnalytics() {
  const [data, setData] = useState<VisitorsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void (async () => {
      try {
        const out = await fetchVisitorsAnalyticsApi();
        if (!mounted) return;
        setData(out);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Analytics</h1>
        {data?.updatedAt ? (
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(data.updatedAt).toLocaleString()}
          </div>
        ) : null}
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="text-sm text-muted-foreground">Unique visitors (all time)</div>
        <div className="text-3xl font-bold tabular-nums pt-1">
          {loading ? '—' : String(data?.totalUniqueVisitors ?? 0)}
        </div>
        <div className="text-xs text-muted-foreground pt-2">
          Counts anonymous browser devices via a cookie; admin activity is excluded.
        </div>
      </div>
    </div>
  );
}

