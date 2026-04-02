import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fetchMyOrdersApi } from '@/lib/authApi';
import type { Order } from '@/types';

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchMyOrdersApi();
        if (!mounted) return;
        setOrders(list);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load orders');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  if (orders.length === 0)
    return (
      <div className="py-10 text-center text-muted-foreground">
        No orders yet.
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>
      <div className="space-y-4">
        {orders.map(o => (
          <div key={o.id} className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="font-mono font-semibold">{o.id}</div>
              <div className="text-xs px-2 py-1 rounded-full bg-background border">
                {o.status}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Placed: {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
            </div>
            <div className="mt-2 font-semibold">Total: ₹{o.total}</div>
            <div className="mt-2 text-sm space-y-1">
              {o.items.map(i => (
                <div key={i.lineId ?? `${o.id}-${i.productId}`}>
                  {i.name} × {i.quantity}
                  {i.customDesignName ? ` · Design: ${i.customDesignName}` : ''}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

