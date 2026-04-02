import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchMyOrdersApi } from '@/lib/authApi';
import type { Order } from '@/types';
import { ArrowLeft, Package, Clock } from 'lucide-react';

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

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
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/account" className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border bg-card shadow-sm p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No orders yet. Start shopping!</p>
          <Link to="/" className="inline-block text-sm text-primary font-medium hover:underline">Browse Products</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">{o.id}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusColor[o.status] || 'bg-muted text-muted-foreground'}`}>
                    {o.status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </div>
                <div className="space-y-1.5">
                  {o.items.map(i => (
                    <div key={i.lineId ?? `${o.id}-${i.productId}`} className="text-sm flex justify-between gap-2">
                      <span className="truncate">{i.name} × {i.quantity}</span>
                      {i.customDesignName && <span className="text-xs text-muted-foreground shrink-0">✦ {i.customDesignName}</span>}
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="font-bold text-sm">₹{o.total}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
