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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">Unique visitors (all time)</div>
          <div className="text-3xl font-bold tabular-nums pt-1">
            {loading ? '-' : String(data?.totalUniqueVisitors ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            Counts anonymous browser devices via a cookie; admin activity is excluded.
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">Users who added to cart</div>
          <div className="text-3xl font-bold tabular-nums pt-1">
            {loading ? '-' : String(data?.addToCart.uniqueVisitors ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            Total add-to-cart actions:{' '}
            <span className="font-semibold text-foreground">{loading ? '-' : String(data?.addToCart.totalEvents ?? 0)}</span>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="text-sm text-muted-foreground">Users who reached checkout</div>
          <div className="text-3xl font-bold tabular-nums pt-1">
            {loading ? '-' : String(data?.checkout.uniqueVisitors ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            Total checkout page visits:{' '}
            <span className="font-semibold text-foreground">{loading ? '-' : String(data?.checkout.totalVisits ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Most Added Products (Add to Cart)</h2>
          <p className="text-xs text-muted-foreground pt-0.5">
            Shows which products users add most often.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                <th className="text-left px-4 py-2.5 font-semibold">Add to cart count</th>
                <th className="text-left px-4 py-2.5 font-semibold">Unique users</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                    Loading...
                  </td>
                </tr>
              ) : (data?.addToCart.topProducts?.length ?? 0) === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                    No add-to-cart data yet.
                  </td>
                </tr>
              ) : (
                data!.addToCart.topProducts.map((row) => (
                  <tr key={row.productId || row.productName} className="border-t">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{row.productName || row.productId}</div>
                      {row.productId ? <div className="text-xs text-muted-foreground">{row.productId}</div> : null}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{row.totalAdds}</td>
                    <td className="px-4 py-2.5 tabular-nums">{row.uniqueVisitors}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
