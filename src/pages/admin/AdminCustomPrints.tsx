import { useOrders } from '@/contexts/OrdersContext';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrderStatus } from '@/types';

function statusClass(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'packed':
      return 'bg-blue-100 text-blue-800';
    case 'shipped':
      return 'bg-purple-100 text-purple-800';
    case 'delivered':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function AdminCustomPrints() {
  const { orders, adminKeySet, ordersLoading } = useOrders();
  const customOrders = orders.filter(o => o.hasCustomPrint);

  if (!adminKeySet) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Custom Print Orders</h1>
        <p className="text-muted-foreground">Set the admin API key above to load orders.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Custom Print Orders</h1>
      {ordersLoading && orders.length === 0 ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : customOrders.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No custom print orders yet.</p>
      ) : (
        <div className="space-y-4">
          {customOrders.map(o => (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-semibold">{o.id}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusClass(o.status)}`}>{o.status}</span>
              </div>
              {o.items
                .filter(i => i.customDesignUrl || i.customDesignName)
                .map((i, idx) => (
                  <div key={`${o.id}-${i.lineId ?? idx}`} className="text-sm space-y-1 bg-muted/50 rounded-md p-3 mb-2">
                    <p>
                      <span className="text-muted-foreground">Product:</span>{' '}
                      {i.customProductType === 'tshirt' ? 'T-shirt' : i.customProductType === 'mug' ? 'Cup' : 'Item'}
                      {' — '}
                      {i.selectedVariant}
                      {i.selectedSize && ` · Size ${i.selectedSize}`}
                      {i.selectedSleeve && ` · ${i.selectedSleeve}`}
                    </p>
                    {i.customDesignName && (
                      <p>
                        <span className="text-muted-foreground">Design:</span> {i.customDesignName}
                      </p>
                    )}
                    {i.customDesignUrl && /^https?:\/\//i.test(i.customDesignUrl) && (
                      <a href={i.customDesignUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-1 mt-1" type="button">
                          <Download className="h-3 w-3" /> Open design URL
                        </Button>
                      </a>
                    )}
                    {i.customDesignUrl && i.customDesignUrl.startsWith('data:') && (
                      <p className="text-xs text-muted-foreground">Design stored inline with order (no file link).</p>
                    )}
                  </div>
                ))}
              <p className="text-sm">
                <span className="text-muted-foreground">Customer:</span> {o.customer.name} · {o.customer.email} · {o.customer.phone}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
