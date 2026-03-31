import { useOrders } from '@/contexts/OrdersContext';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminCustomPrints() {
  const { orders } = useOrders();
  const customOrders = orders.filter(o => o.hasCustomPrint);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Custom Print Orders</h1>
      {customOrders.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No custom print orders yet.</p>
      ) : (
        <div className="space-y-4">
          {customOrders.map(o => (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-semibold">{o.id}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${o.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{o.status}</span>
              </div>
              {o.items.filter(i => i.customDesignFile).map((i, idx) => (
                <div key={`${o.id}-${i.cartLineId}-${idx}`} className="text-sm space-y-1 bg-muted/50 rounded-md p-3 mb-2">
                  <p>
                    <span className="text-muted-foreground">Product:</span>{' '}
                    {i.customProductType === 'tshirt' ? 'T-shirt' : 'Cup'}
                    {' — '}
                    {i.selectedVariant}
                    {i.selectedSize && ` · Size ${i.selectedSize}`}
                    {i.selectedSleeve && ` · ${i.selectedSleeve}`}
                  </p>
                  <p><span className="text-muted-foreground">Design:</span> {i.customDesignName}</p>
                  {i.customDesignFile && (
                    <Button variant="outline" size="sm" className="gap-1 mt-1">
                      <Download className="h-3 w-3" /> Download Design
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-sm"><span className="text-muted-foreground">Customer:</span> {o.customer.name} • {o.customer.phone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
