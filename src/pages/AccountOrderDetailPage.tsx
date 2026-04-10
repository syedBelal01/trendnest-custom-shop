import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchMyOrderByIdApi } from '@/lib/authApi';
import type { Order } from '@/types';
import { ArrowLeft, Truck, MapPin, Package, Clock } from 'lucide-react';

function fmtDate(d: string | undefined | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AccountOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    (async () => {
      try {
        const o = await fetchMyOrderByIdApi(id);
        if (mounted) setOrder(o);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load order');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const timeline = useMemo(() => {
    const t = order?.shipping?.timeline;
    const list = Array.isArray(t) ? t : [];
    return list
      .map(e => ({
        at: String((e as any).at || ''),
        kind: String((e as any).kind || 'event'),
        status: (e as any).status ? String((e as any).status) : undefined,
        source: (e as any).source ? String((e as any).source) : undefined,
        error: (e as any).error ? String((e as any).error) : undefined,
      }))
      .filter(e => !!e.at)
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [order?.shipping?.timeline]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-8 space-y-3">
        <Link to="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Order not found.</div>
      </div>
    );
  }

  const shipping = order.shipping;
  const trackingReady = !!(shipping?.awb || shipping?.trackingStatus || (shipping?.timeline && shipping.timeline.length > 0));

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/account/orders" className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-xs font-mono text-muted-foreground truncate">{order.id}</div>
          <div className="text-lg sm:text-xl font-bold">Order Tracking</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold capitalize flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Status: {order.status}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Placed: {fmtDate(order.createdAt)}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Total
            <div className="text-sm font-bold text-foreground">₹{order.total}</div>
          </div>
        </div>

        {shipping?.manualRequired ? (
          <div className="rounded-xl border bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-xs">
            <span className="font-semibold">Processing manually.</span>{' '}
            {shipping.manualReason ? `Shipment delayed: ${shipping.manualReason}` : 'Shipment is delayed; our team is working on it.'}
          </div>
        ) : !trackingReady ? (
          <div className="rounded-xl border bg-muted/40 text-muted-foreground px-3 py-2 text-xs">
            <span className="font-semibold text-foreground">Tracking will be available soon.</span> We’ll update this page once your shipment is created.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex items-start gap-2">
            <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Courier</div>
              <div className="text-muted-foreground text-xs">
                {shipping?.courierName || (shipping?.awb ? 'Courier assigned' : '—')}{shipping?.awb ? ` · AWB ${shipping.awb}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Delivery ETA</div>
              <div className="text-muted-foreground text-xs">
                {shipping?.estimatedDeliveryDate ? fmtDate(shipping.estimatedDeliveryDate) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
        <div className="text-sm font-bold">Timeline</div>
        {timeline.length === 0 ? (
          <div className="text-xs text-muted-foreground">No tracking updates yet.</div>
        ) : (
          <div className="space-y-2">
            {timeline.map((e, idx) => (
              <div key={`${e.at}-${idx}`} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {e.status || e.kind}
                  </div>
                  {e.error ? <div className="text-xs text-destructive">{e.error}</div> : null}
                  {e.source ? <div className="text-[11px] text-muted-foreground">{e.source}</div> : null}
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0">{fmtDate(e.at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

