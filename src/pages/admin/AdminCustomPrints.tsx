import { useState } from 'react';
import { useOrders } from '@/contexts/OrdersContext';
import { Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { OrderStatus } from '@/types';

function truncateUrl(u: string, max = 72) {
  if (u.length <= max) return u;
  return `${u.slice(0, max - 24)}…${u.slice(-20)}`;
}

function likelyImageDesignUrl(url: string) {
  if (!/^https:\/\//i.test(url)) return false;
  if (/\.pdf(\?|#|$)/i.test(url)) return false;
  if (/\/raw\/upload\//i.test(url)) return false;
  return (
    /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url) || /\/image\/upload\//i.test(url)
  );
}

function DesignThumbnail({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !likelyImageDesignUrl(url)) return null;
  return (
    <img
      src={url}
      alt="Design preview"
      className="mt-2 max-h-28 max-w-[200px] rounded-md border object-contain bg-background"
      onError={() => setFailed(true)}
    />
  );
}

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
                      <div className="mt-2 space-y-2">
                        <DesignThumbnail url={i.customDesignUrl} />
                        <p className="text-xs break-all">
                          <a
                            href={i.customDesignUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                            title={i.customDesignUrl}
                          >
                            {truncateUrl(i.customDesignUrl)}
                          </a>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <a href={i.customDesignUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm" className="gap-1" type="button">
                              <Download className="h-3 w-3" /> Open design
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(i.customDesignUrl!).then(
                                () => toast.success('Design URL copied'),
                                () => toast.error('Could not copy URL')
                              );
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copy URL
                          </Button>
                        </div>
                      </div>
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
