import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchMyOrderByIdApi } from '@/lib/authApi';
import type { Order } from '@/types';
import { ArrowLeft, Truck, MapPin, Package, Clock, RefreshCw } from 'lucide-react';

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

  const loadOrder = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    try {
      const o = await fetchMyOrderByIdApi(id);
      setOrder(o);
    } catch (e) {
      if (!opts?.silent) toast.error(e instanceof Error ? e.message : 'Could not load order');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const pendingShippingFinalize = order?.shipping?.estimated === true && order?.shipping?.finalized !== true;

  useEffect(() => {
    if (!pendingShippingFinalize || !id) return;
    const t = window.setInterval(() => void loadOrder({ silent: true }), 12_000);
    return () => window.clearInterval(t);
  }, [pendingShippingFinalize, id, loadOrder]);

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
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs font-mono text-muted-foreground truncate">{order.id}</div>
          <div className="text-lg sm:text-xl font-bold">Order Tracking</div>
        </div>
        <button
          type="button"
          onClick={() => void loadOrder()}
          className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0"
          title="Refresh order"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
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
            <div className="text-sm font-bold text-foreground tabular-nums">₹{order.total}</div>
          </div>
        </div>

        {(order.goodsTotal != null || order.shippingCharge != null) && (
          <div className="rounded-xl border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
            {order.goodsTotal != null && (
              <div className="flex justify-between gap-2">
                <span>Items (after discount)</span>
                <span className="tabular-nums text-foreground">₹{order.goodsTotal}</span>
              </div>
            )}
            {order.shippingCharge != null && (
              <div className="flex justify-between gap-2">
                <span>Shipping</span>
                <span className="tabular-nums text-foreground">
                  {order.shippingCharge < 0.005 ? 'Free' : `₹${order.shippingCharge}`}
                </span>
              </div>
            )}
          </div>
        )}

        {pendingShippingFinalize && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 px-3 py-2 text-xs flex items-start gap-2">
            <RefreshCw className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" />
            <span>
              <span className="font-semibold">Finalizing shipping.</span> Your order used an estimated ₹0 shipping row; we are
              fetching the live courier rate. This page refreshes automatically every few seconds.
            </span>
          </div>
        )}

        {shipping?.quoteRecalcError && !pendingShippingFinalize && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 text-destructive px-3 py-2 text-xs">
            Could not load final shipping quote: {shipping.quoteRecalcError}. Our team may update this order manually.
          </div>
        )}

        {(shipping?.pricingPendingReview || (shipping?.balanceDueShipping != null && shipping.balanceDueShipping > 0.004)) && (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100 px-3 py-2 text-xs space-y-1">
            <div className="font-semibold">Shipping adjustment</div>
            {shipping?.balanceDueShipping != null && shipping.balanceDueShipping > 0.004 && (
              <p>
                Additional shipping due: <span className="font-mono font-semibold">₹{shipping.balanceDueShipping}</span>
                {order.paymentMethod === 'razorpay' ? ' (prepaid order — our team may contact you).' : null}
              </p>
            )}
            {shipping?.pricingPendingReview && (
              <p className="text-[11px] opacity-90">This order is flagged for review after the courier rate was applied.</p>
            )}
          </div>
        )}

        {shipping?.manualRequired ? (
          <div className="rounded-xl border bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 px-3 py-2 text-xs">
            <span className="font-semibold">Processing manually.</span>{' '}
            {shipping.manualReason ? `Shipment delayed: ${shipping.manualReason}` : 'Shipment is delayed; our team is working on it.'}
          </div>
        ) : !trackingReady && !pendingShippingFinalize ? (
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
