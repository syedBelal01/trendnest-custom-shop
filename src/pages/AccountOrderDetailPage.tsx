import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cancelMyOrderApi, fetchMyOrderByIdApi } from '@/lib/authApi';
import { requestReturnApi, uploadReturnImageApi } from '@/lib/returnsApi';
import type { Order, OrderLineSnapshot, OrderReturnRequest } from '@/types';
import { ArrowLeft, Truck, MapPin, Package, Clock, RefreshCw, Undo2, ImagePlus, ExternalLink } from 'lucide-react';
import { returnHasPostApprovalTracking, returnShipmentTrackingUrl } from '@/lib/returnTracking';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/** Default; server uses RETURN_WINDOW_DAYS env (must match for accurate messaging). */
const RETURN_WINDOW_DAYS = 7;

function fmtDate(d: string | undefined | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stableLineId(item: OrderLineSnapshot, index: number) {
  if (item.lineId != null && String(item.lineId).trim()) return String(item.lineId).trim();
  return `idx:${index}`;
}

function hasBlockingReturn(o: Order) {
  const block = new Set(['requested', 'approved', 'picked_up', 'received']);
  return (o.returnRequests ?? []).some(r => block.has(r.status));
}

function returnBlockReason(order: Order): string | null {
  if (order.hasCustomPrint) return 'Custom print orders are not eligible for self-serve returns.';
  if (order.status !== 'delivered') return 'Returns open after your order is delivered.';
  const d = order.deliveredAt ? new Date(order.deliveredAt) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Delivery date is not on file yet — check back shortly.';
  if (Date.now() > d.getTime() + RETURN_WINDOW_DAYS * 86400000) {
    return `The ${RETURN_WINDOW_DAYS}-day return window from delivery has ended.`;
  }
  if (hasBlockingReturn(order)) return 'A return is already in progress for this order.';
  return null;
}

function returnStatusLabel(s: string) {
  const m: Record<string, string> = {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    picked_up: 'Picked up',
    received: 'Received at warehouse',
    refunded: 'Refunded',
  };
  return m[s] || s;
}

export default function AccountOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [returnImages, setReturnImages] = useState<string[]>([]);
  const [partialMode, setPartialMode] = useState(false);
  const [lineQty, setLineQty] = useState<Record<string, number>>({});
  const [submitBusy, setSubmitBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

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
  const canCancel = order?.status === 'pending' || order?.status === 'confirmed';

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

  const openReturnDialog = () => {
    if (!order) return;
    const init: Record<string, number> = {};
    order.items.forEach((it, i) => {
      init[stableLineId(it, i)] = Number(it.quantity) || 0;
    });
    setLineQty(init);
    setPartialMode(false);
    setReason('');
    setReturnImages([]);
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!order) return;
    const r = reason.trim();
    if (r.length < 10) {
      toast.error('Please enter a reason (at least 10 characters).');
      return;
    }
    setSubmitBusy(true);
    try {
      if (partialMode) {
        const lines = Object.entries(lineQty)
          .filter(([, q]) => q > 0)
          .map(([lineId, quantity]) => ({ lineId, quantity }));
        await requestReturnApi({
          orderId: order.id,
          reason: r,
          images: returnImages,
          scope: 'partial',
          lines,
        });
      } else {
        await requestReturnApi({
          orderId: order.id,
          reason: r,
          images: returnImages,
          scope: 'full',
        });
      }
      toast.success('Return request submitted');
      setReturnOpen(false);
      await loadOrder();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setSubmitBusy(false);
    }
  };

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (returnImages.length >= 6) {
      toast.message('Maximum 6 images');
      return;
    }
    setUploadBusy(true);
    try {
      const { url } = await uploadReturnImageApi(f);
      if (url) setReturnImages(prev => [...prev, url]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadBusy(false);
    }
  };

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
  const returnBlock = returnBlockReason(order);
  const canOpenReturn = !returnBlock;

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/account/orders" className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] sm:text-xs font-mono text-muted-foreground truncate">{order.id}</div>
          <div className="text-lg sm:text-xl font-bold">
            {order.status === 'delivered' ? 'Order details' : 'Order tracking'}
          </div>
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
            {order.deliveredAt ? (
              <div className="text-xs text-muted-foreground">Delivered: {fmtDate(order.deliveredAt)}</div>
            ) : null}
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
                  Free
                </span>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border bg-muted/20 px-3 py-2 space-y-2">
          <div className="text-xs font-semibold text-foreground">Items</div>
          <ul className="text-sm space-y-1.5">
            {order.items.map((it, i) => (
              <li key={stableLineId(it, i)} className="flex justify-between gap-2">
                <span className="min-w-0">
                  {it.name} ×{it.quantity}
                  {it.selectedVariant ? <span className="text-muted-foreground text-xs"> · {it.selectedVariant}</span> : null}
                </span>
                <span className="tabular-nums shrink-0">₹{(Number(it.price) || 0) * (Number(it.quantity) || 0)}</span>
              </li>
            ))}
          </ul>
        </div>

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
        ) : !trackingReady && !pendingShippingFinalize && order.status !== 'delivered' ? (
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
                3-5 days
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t space-y-2">
          {order.status === 'cancelled' ? (
            <div className="rounded-xl border bg-muted/40 px-3 py-2 text-xs space-y-1">
              <div className="font-semibold">Order cancelled</div>
              {order.cancelledAt ? <div className="text-muted-foreground">Cancelled at: {fmtDate(order.cancelledAt)}</div> : null}
              {order.cancellationRefund?.kind === 'razorpay' ? (
                <div className="text-muted-foreground">
                  Refund: <span className="font-semibold">{order.cancellationRefund.status || 'pending'}</span>
                  {order.cancellationRefund.amount != null ? ` · ₹${order.cancellationRefund.amount}` : ''}
                  {order.cancellationRefund.status === 'completed'
                    ? ' (initiated)'
                    : order.cancellationRefund.status === 'failed'
                      ? order.cancellationRefund.error
                        ? ` — ${order.cancellationRefund.error}`
                        : ' — refund initiation failed'
                      : ' — will reflect in 2–5 working days'}
                </div>
              ) : null}
            </div>
          ) : canCancel ? (
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">More actions</div>
              <button
                type="button"
                className="w-full text-left text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground active:opacity-80"
                onClick={() => {
                  setCancelReason('');
                  setCancelOpen(true);
                }}
              >
                Cancel this order
              </button>
            </div>
          ) : null}

          {canOpenReturn ? (
            <Button type="button" className="w-full gap-2" variant="secondary" onClick={openReturnDialog}>
              <Undo2 className="h-4 w-4" />
              Request a return
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{returnBlock}</p>
          )}
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={(o) => (cancelBusy ? null : setCancelOpen(o))}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              You can cancel only before the order is shipped. For online payments, refunds typically reflect in 2–5 working days.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Tell us why you’re cancelling (optional)"
                disabled={cancelBusy}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                type="button"
                variant="destructive"
                disabled={cancelBusy || !id}
                onClick={() => {
                  if (!id) return;
                  setCancelBusy(true);
                  void (async () => {
                    try {
                      const out = await cancelMyOrderApi(id, cancelReason.trim());
                      toast.success(out.message || 'Order cancelled');
                      setCancelOpen(false);
                      setOrder(out.order);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Could not cancel order');
                    } finally {
                      setCancelBusy(false);
                    }
                  })();
                }}
              >
                Confirm cancel
              </Button>
              <Button type="button" variant="outline" disabled={cancelBusy} onClick={() => setCancelOpen(false)}>
                Keep order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {(order.returnRequests?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
          <div className="text-sm font-bold">Returns</div>
          {(order.returnRequests ?? []).map((ret: OrderReturnRequest) => (
            <div key={ret.returnId} className="rounded-xl border bg-muted/20 p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{ret.returnId}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {returnStatusLabel(ret.status)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {ret.scope === 'full' ? 'Full order' : 'Partial'} · Requested {fmtDate(ret.requestedAt)}
              </p>
              <p className="text-sm">{ret.reason}</p>
              {ret.rejectionReason ? (
                <p className="text-xs text-destructive">Rejected: {ret.rejectionReason}</p>
              ) : null}
              {returnHasPostApprovalTracking(ret) && !ret.reverseShipment?.awb?.trim() ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/80 bg-muted/20 px-2.5 py-2">
                  Return approved. <span className="font-medium text-foreground">Tracking will show here</span> once a pickup
                  waybill (AWB) is assigned — refresh this page after you receive pickup details.
                </p>
              ) : null}
              {ret.reverseShipment?.awb?.trim() ? (
                <div className="space-y-2">
                  <p className="text-xs">
                    Return AWB: <span className="font-mono">{ret.reverseShipment.awb.trim()}</span>
                    {ret.reverseShipment.courierName ? ` · ${ret.reverseShipment.courierName}` : ''}
                  </p>
                  <a
                    href={returnShipmentTrackingUrl(ret.reverseShipment) ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline active:opacity-70"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    Track return shipment
                  </a>
                </div>
              ) : null}
              {ret.refund?.status === 'completed' ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Refund {ret.refund.kind === 'razorpay' ? '(online)' : ret.refund.kind === 'store_credit' ? '(store credit)' : '(manual)'}
                  {ret.refund.amount != null ? ` · ₹${ret.refund.amount}` : ''}
                </p>
              ) : null}
              {Array.isArray(ret.timeline) && ret.timeline.length > 0 ? (
                <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/60">
                  {ret.timeline
                    .slice()
                    .reverse()
                    .map((ev, idx) => (
                      <div key={idx} className="flex justify-between gap-2">
                        <span>
                          {ev.action}
                          {ev.actor ? ` · ${ev.actor}` : ''}
                          {ev.note ? ` — ${ev.note}` : ''}
                        </span>
                        <span className="shrink-0">{fmtDate(ev.at)}</span>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
        <div className="text-sm font-bold">Shipment timeline</div>
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

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request a return</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Eligible within {RETURN_WINDOW_DAYS} days of delivery (excluding custom print). Our team will review your request.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={partialMode} onChange={e => setPartialMode(e.target.checked)} />
              <span>Return only some items</span>
            </label>
            {partialMode ? (
              <div className="space-y-2 rounded-lg border p-2">
                {order.items.map((it, i) => {
                  const lid = stableLineId(it, i);
                  const maxQ = Number(it.quantity) || 0;
                  return (
                    <div key={lid} className="flex items-center justify-between gap-2">
                      <span className="text-xs min-w-0 flex-1 truncate">{it.name}</span>
                      <Input
                        type="number"
                        className="w-16 h-8 text-xs"
                        min={0}
                        max={maxQ}
                        value={lineQty[lid] ?? 0}
                        onChange={e =>
                          setLineQty(q => ({
                            ...q,
                            [lid]: Math.max(0, Math.min(maxQ, Math.floor(Number(e.target.value) || 0))),
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div>
              <Label htmlFor="ret-reason">Reason</Label>
              <Textarea
                id="ret-reason"
                className="mt-1 min-h-[100px]"
                placeholder="Describe the issue (min. 10 characters)"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <div>
              <Label>Photos (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {returnImages.map(u => (
                  <img key={u} src={u} alt="" className="h-14 w-14 rounded object-cover border" />
                ))}
                {returnImages.length < 6 ? (
                  <label className="h-14 w-14 rounded border border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/50">
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" disabled={uploadBusy} onChange={e => void onPickImage(e)} />
                  </label>
                ) : null}
              </div>
            </div>
            <Button type="button" className="w-full" disabled={submitBusy || uploadBusy} onClick={() => void submitReturn()}>
              {submitBusy ? 'Submitting…' : 'Submit return request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
