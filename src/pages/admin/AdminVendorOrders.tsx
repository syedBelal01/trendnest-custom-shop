import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  downloadOrderInvoicePdf,
  getAdminApiKey,
  patchOrderStatusApi,
  syncOrderShippingStatusAdmin,
} from '@/lib/ordersApi';
import { fetchAdminVendorOrdersApi, type AdminVendorOrder } from '@/lib/vendorOrdersApi';
import type { OrderLineSnapshot, OrderStatus } from '@/types';

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

export default function AdminVendorOrders() {
  const adminKeySet = !!getAdminApiKey();
  const [orders, setOrders] = useState<AdminVendorOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getAdminApiKey()) return;
    setLoading(true);
    try {
      const list = await fetchAdminVendorOrdersApi();
      setOrders(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load vendor orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      const updated = await patchOrderStatusApi(id, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...updated, sellerNames: o.sellerNames, sellerIds: o.sellerIds } : o))
      );
      toast.success(`Order ${id} → ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
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
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...updated, sellerNames: o.sellerNames, sellerIds: o.sellerIds } : o))
      );
      toast.success(`Synced: ${updated.status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncBusy(null);
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  if (!adminKeySet) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Vendor Orders</h1>
        <p className="text-muted-foreground">Set the admin API key above to load vendor orders.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vendor Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orders that include marketplace vendor products. Main Orders page is unchanged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="packed">Packed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && orders.length === 0 ? (
        <p className="text-muted-foreground py-10">Loading vendor orders…</p>
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
                  {(o.sellerNames?.length || 0) > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200 px-2 py-0.5 rounded-full font-medium">
                      Sold by: {o.sellerNames.join(', ')}
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
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="packed">Packed</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  <span className="text-muted-foreground">Address:</span> {o.customer.address}, {o.customer.city} -{' '}
                  {o.customer.pincode}
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
                <p className="font-semibold pt-1">Total: ₹{o.total}</p>
                {(o.paymentMethod || o.paymentStatus) && (
                  <p className="text-xs text-muted-foreground">
                    Payment: {o.paymentMethod === 'razorpay' ? 'Online' : o.paymentMethod === 'cod' ? 'COD' : '—'}
                    {o.paymentStatus ? ` · ${o.paymentStatus}` : ''}
                  </p>
                )}
                {o.createdAt && (
                  <p className="text-xs text-muted-foreground">Placed: {new Date(o.createdAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-10">No vendor orders found.</p>
          )}
        </div>
      )}
    </div>
  );
}
