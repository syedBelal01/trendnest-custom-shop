import { useState } from 'react';
import { useOrders } from '@/contexts/OrdersContext';
import { OrderLineSnapshot, OrderStatus } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { downloadOrderInvoicePdf } from '@/lib/ordersApi';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  packed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
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

export default function AdminOrders() {
  const { orders, adminKeySet, updateOrderStatus, ordersLoading } = useOrders();
  const [filter, setFilter] = useState<string>('all');
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateOrderStatus(id, status);
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

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

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
        <h1 className="text-2xl font-bold">Orders</h1>
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
          {filtered.map(o => (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{o.id}</span>
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[o.status]}`}>{o.status}</span>
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
                  <span className="text-muted-foreground">Customer:</span> {o.customer.name} · {o.customer.email} · {o.customer.phone}
                </p>
                <p>
                  <span className="text-muted-foreground">Address:</span> {o.customer.address}, {o.customer.city} - {o.customer.pincode}
                </p>
                <div className="text-muted-foreground">Items:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {o.items.map(i => {
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
                <p className="font-semibold">Total: ₹{o.total}</p>
                {(o.paymentMethod || o.paymentStatus) && (
                  <p className="text-xs text-muted-foreground">
                    Payment: {o.paymentMethod === 'razorpay' ? 'Online' : o.paymentMethod === 'cod' ? 'COD' : '—'}
                    {o.paymentStatus ? ` · ${o.paymentStatus}` : ''}
                    {o.amountDue != null ? ` · Due ₹${o.amountDue}` : ''}
                    {o.amountPaid != null && o.amountPaid > 0 ? ` · Paid ₹${o.amountPaid}` : ''}
                  </p>
                )}
                {o.createdAt && (
                  <p className="text-xs text-muted-foreground">Placed: {new Date(o.createdAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !ordersLoading && <p className="text-center text-muted-foreground py-10">No orders found.</p>}
        </div>
      )}
    </div>
  );
}
