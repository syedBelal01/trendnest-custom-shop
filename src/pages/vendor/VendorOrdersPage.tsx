import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  fetchVendorOrdersApi,
  patchVendorOrderStatusApi,
  type VendorOrder,
} from '@/lib/vendorOrdersApi';
import type { Vendor } from '@/lib/vendorsApi';
import type { OrderStatus } from '@/types';

type OutletCtx = { vendor: Vendor | null };

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  packed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

export default function VendorOrdersPage() {
  const { vendor } = useOutletContext<OutletCtx>();
  const nav = useNavigate();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    if (vendor.status !== 'approved') {
      nav('/vendor');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { orders: list } = await fetchVendorOrdersApi();
        if (!cancelled) setOrders(list);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendor, nav]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    setBusyId(id);
    try {
      const updated = await patchVendorOrderStatusApi(id, status);
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)));
      toast.success(`Order ${id} → ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading orders…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Only orders that include your products. Customer name and address are shown for fulfillment.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-10">
          No orders yet. Once a customer buys your published product, it will appear here.
        </p>
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{o.id}</span>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium capitalize ${
                      statusColors[o.status] || 'bg-muted'
                    }`}
                  >
                    {o.status}
                  </span>
                  {o.paymentStatus === 'unpaid' && (
                    <span className="text-xs bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200 px-2 py-0.5 rounded-full font-medium">
                      Payment pending
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {o.canUpdateStatus ? (
                    <Select
                      value={o.status}
                      disabled={busyId === o.id}
                      onValueChange={(v) => void updateStatus(o.id, v as OrderStatus)}
                    >
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">Status by admin (mixed cart)</span>
                  )}
                </div>
              </div>

              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Customer:</span> {o.customer.name} ·{' '}
                  {o.customer.email} · {o.customer.phone}
                </p>
                <p>
                  <span className="text-muted-foreground">Address:</span> {o.customer.address}
                  {o.customer.city ? `, ${o.customer.city}` : ''}
                  {o.customer.state ? `, ${o.customer.state}` : ''}
                  {o.customer.pincode ? ` - ${o.customer.pincode}` : ''}
                </p>
                <div className="text-muted-foreground">Your items:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {o.items.map((i, idx) => (
                    <li key={`${i.productId}-${idx}`}>
                      {i.name} ×{i.quantity}
                      {(i.selectedVariant || i.selectedSize) && (
                        <span className="text-foreground">
                          {' '}
                          — {[i.selectedVariant, i.selectedSize].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="pt-1">
                  <span className="text-muted-foreground">Your goods total:</span>{' '}
                  <span className="font-semibold">₹{o.goodsTotal}</span>
                  {o.paymentMethod ? (
                    <>
                      {' '}
                      · {o.paymentMethod.toUpperCase()}
                      {o.paymentStatus ? ` · ${o.paymentStatus}` : ''}
                    </>
                  ) : null}
                </p>
                {o.createdAt ? (
                  <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
