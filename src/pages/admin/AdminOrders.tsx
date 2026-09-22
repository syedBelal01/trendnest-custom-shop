import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '@/contexts/OrdersContext';
import { Order, OrderLineSnapshot, OrderStatus } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { downloadOrderInvoicePdf, syncOrderShippingStatusAdmin } from '@/lib/ordersApi';
import { fetchAdminVendorOrdersApi } from '@/lib/vendorOrdersApi';
import { collectCodAdminApi } from '@/lib/paymentSettingsApi';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';

function paymentMethodLabel(method?: string): string {
  if (method === 'razorpay') return 'Online';
  if (method === 'cod') return 'COD';
  if (method === 'partial') return 'Partial';
  return '—';
}

function paymentStatusLabel(status?: string): string {
  if (status === 'partially_paid') return 'Partially paid';
  return status || '';
}

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  packed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

function itemDetail(i: OrderLineSnapshot): string {
  const parts: string[] = [];
  if (i.selectedSize) parts.push(`Size: ${i.selectedSize}`);
  if (i.selectedVariant) parts.push(`Color: ${i.selectedVariant}`);
  if (i.selectedSleeve) parts.push(`Sleeve: ${i.selectedSleeve}`);
  if (i.customProductType === 'tshirt') parts.push('Type: T-shirt');
  if (i.customProductType === 'mug') parts.push('Type: Cup');
  if (i.customDesignName) parts.push(`Design: ${i.customDesignName}`);
  return parts.join(' · ');
}

/** Vendor marketplace orders belong on Admin → Vendor Orders, not this list. */
function isVendorMarketplaceOrder(o: Order, vendorOrderIds: Set<string>): boolean {
  if (vendorOrderIds.has(String(o.id))) return true;
  return (o.items || []).some((it) => {
    if (it.vendorId) return true;
    const pid = String(it.productId || '');
    // Vendor product IDs are created as `vp{timestamp}-…`
    if (pid.startsWith('vp')) return true;
    return false;
  });
}

export default function AdminOrders() {
  const { orders, adminKeySet, updateOrderStatus, ordersLoading, refreshOrders } = useOrders();
  const [filter, setFilter] = useState<string>('all');
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<string | null>(null);
  const [collectBusy, setCollectBusy] = useState<string | null>(null);
  const [vendorOrderIds, setVendorOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!adminKeySet) {
      setVendorOrderIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchAdminVendorOrdersApi()
      .then((list) => {
        if (!cancelled) setVendorOrderIds(new Set(list.map((o) => String(o.id))));
      })
      .catch(() => {
        /* local heuristics below still apply */
      });
    return () => {
      cancelled = true;
    };
  }, [adminKeySet, orders]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
      toast.success(`Order ${id} → ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const onCollectCod = async (id: string) => {
    setCollectBusy(id);
    try {
      await collectCodAdminApi(id);
      await refreshOrders();
      toast.success('COD marked as collected');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to collect COD');
    } finally {
      setCollectBusy(null);
    }
  };

  const onDownloadPdf = async (id: string) => {
    setPdfBusy(id);
    try {
      await downloadOrderInvoicePdf(id);
      toast.success('Invoice downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setPdfBusy(null);
    }
  };

  const onSyncStatus = async (id: string) => {
    setSyncBusy(id);
    try {
      const updated = await syncOrderShippingStatusAdmin(id);
      toast.success(`Synced: ${updated.status}`);
      await refreshOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncBusy(null);
    }
  };

  const platformOrders = useMemo(
    () => orders.filter((o) => !isVendorMarketplaceOrder(o, vendorOrderIds)),
    [orders, vendorOrderIds]
  );
  const filtered = filter === 'all' ? platformOrders : platformOrders.filter((o) => o.status === filter);

  if (!adminKeySet) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Orders</h1>
        <p className="text-muted-foreground">Set the admin API key above to load orders from the server.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform orders only. Vendor orders are under Vendor Orders.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="packed">Packed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {ordersLoading && orders.length === 0 ? (
        <p className="text-muted-foreground py-10">Loading orders…</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{o.id}</span>
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[o.status]}`}>
                    {o.status}
                  </span>
                  {o.hasCustomPrint && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Custom</span>
                  )}
                  {o.emailError && (
                    <span className="text-xs text-destructive" title={o.emailError}>
                      Email issue
                    </span>
                  )}
                  {o.needsShippingReview && (
                    <span className="text-xs bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200 px-2 py-0.5 rounded-full font-medium">
                      Shipping review
                    </span>
                  )}
                  {o.paymentPending && (
                    <span className="text-xs bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200 px-2 py-0.5 rounded-full font-medium">
                      Payment pending
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={pdfBusy === o.id}
                    onClick={() => void onDownloadPdf(o.id)}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {pdfBusy === o.id ? 'PDF…' : 'Invoice PDF'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncBusy === o.id}
                    onClick={() => void onSyncStatus(o.id)}
                  >
                    {syncBusy === o.id ? 'Sync…' : 'Sync Status'}
                  </Button>
                  <Select value={o.status} onValueChange={(v: OrderStatus) => void updateStatus(o.id, v)}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="packed">Packed</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Customer:</span> {o.customer.name} · {o.customer.email} ·{' '}
                  {o.customer.phone}
                </p>
                <p>
                  <span className="text-muted-foreground">Address:</span> {o.customer.address || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">City:</span> {o.customer.city || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">State:</span> {o.customer.state || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Pincode:</span> {o.customer.pincode || '—'}
                </p>
                <div className="text-muted-foreground">Items:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {o.items.map((i) => {
                    const detail = itemDetail(i);
                    const key = i.lineId ?? `${o.id}-${i.productId}-${i.name}`;
                    return (
                      <li key={key}>
                        {i.name} ×{i.quantity}
                        {detail && <span className="text-foreground"> — {detail}</span>}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-muted-foreground pt-1">
                  Subtotal ₹{o.subtotal}
                  {o.discount > 0 && ` · Discount -₹${o.discount}${o.couponCode ? ` (${o.couponCode})` : ''}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Shipping (internal): ₹{Number(o.actualShippingCharge ?? 0).toFixed(0)}
                  {o.goodsTotal != null
                    ? ` · Profit: ₹${Math.max(0, Math.round((Number(o.goodsTotal) || 0) - (Number(o.actualShippingCharge) || 0)))}`
                    : ''}
                </p>
                <p className="font-semibold">Total: ₹{o.total}</p>
                {(o.paymentMethod || o.paymentStatus) && (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Payment: {paymentMethodLabel(o.paymentMethod)}
                      {o.paymentStatus ? ` · ${paymentStatusLabel(o.paymentStatus)}` : ''}
                      {o.amountDue != null && o.amountDue > 0.005 ? ` · Due ₹${o.amountDue}` : ''}
                      {o.amountPaid != null && o.amountPaid > 0 ? ` · Paid ₹${o.amountPaid}` : ''}
                    </p>
                    {o.paymentMethod === 'partial' && o.paymentSnapshot && (
                      <p className="text-xs text-muted-foreground">
                        Snapshot: Online ₹{Number(o.paymentSnapshot.onlineDue ?? 0)} · COD ₹
                        {Number(o.paymentSnapshot.codDue ?? 0)}
                        {o.codCollectionStatus === 'collected'
                          ? ' · COD collected'
                          : o.codCollectionStatus === 'pending'
                            ? ' · COD pending'
                            : ''}
                      </p>
                    )}
                    {o.paymentMethod === 'partial' &&
                      o.paymentStatus === 'partially_paid' &&
                      o.codCollectionStatus !== 'collected' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          disabled={collectBusy === o.id}
                          onClick={() => void onCollectCod(o.id)}
                        >
                          {collectBusy === o.id ? 'Saving…' : 'Mark COD collected'}
                        </Button>
                      )}
                  </div>
                )}
                {o.createdAt && (
                  <p className="text-xs text-muted-foreground">Placed: {new Date(o.createdAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !ordersLoading && (
            <p className="text-center text-muted-foreground py-10">No orders found.</p>
          )}
        </div>
      )}
    </div>
  );
}
