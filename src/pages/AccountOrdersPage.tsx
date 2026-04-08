import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { fetchMyOrdersApi } from '@/lib/authApi';
import type { Order } from '@/types';
import { ArrowLeft, Package, Clock } from 'lucide-react';
import { fetchReviewPromptsApi } from '@/lib/reviewsApi';
import ReviewDialog from '@/components/reviews/ReviewDialog';
import { useProducts } from '@/contexts/ProductsContext';

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptIds, setPromptIds] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProductId, setReviewProductId] = useState<string | null>(null);
  const { products } = useProducts();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchMyOrdersApi();
        if (!mounted) return;
        setOrders(list);
        try {
          const prompts = await fetchReviewPromptsApi();
          if (!mounted) return;
          setPromptIds(new Set(prompts.map(p => p.productId)));
        } catch {
          // ignore prompts failure
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load orders');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const openReview = (productId: string) => {
    setReviewProductId(productId);
    setReviewOpen(true);
  };

  const reviewProductName =
    (reviewProductId ? products.find(p => p.id === reviewProductId)?.name : null) || 'Product';

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/account" className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors active:bg-muted/70 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg sm:text-xl font-bold">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border bg-card shadow-sm p-6 sm:p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No orders yet. Start shopping!</p>
          <Link to="/" className="inline-block text-sm text-primary font-medium hover:underline">Browse Products</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="p-3.5 sm:p-4 space-y-3">
                {/* Order ID + Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] sm:text-xs font-mono text-muted-foreground block truncate">{o.id}</span>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${statusColor[o.status] || 'bg-muted text-muted-foreground'}`}>
                    {o.status}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {o.items.map(i => (
                    <div key={i.lineId ?? `${o.id}-${i.productId}`} className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm leading-snug block">{i.name} × {i.quantity}</span>
                          {i.customDesignName && (
                            <span className="text-[11px] text-muted-foreground">✦ {i.customDesignName}</span>
                          )}
                        </div>
                      </div>
                      {o.status === 'delivered' && promptIds.has(i.productId) && (
                        <button
                          type="button"
                          className="self-start text-xs font-semibold text-primary hover:underline active:opacity-70 py-0.5"
                          onClick={() => openReview(i.productId)}
                        >
                          Write a Review →
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="font-bold text-sm">₹{o.total}</span>
                </div>

                {(o.paymentMethod || o.paymentStatus) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      Payment: {o.paymentMethod === 'razorpay' ? 'Online' : o.paymentMethod === 'cod' ? 'COD' : '—'}
                    </span>
                    <span className="capitalize">
                      {o.paymentStatus ? `Status: ${o.paymentStatus}` : ''}
                      {o.paymentStatus === 'paid' && o.paidAt ? ` (${new Date(o.paidAt).toLocaleDateString('en-IN')})` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewProductId && (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          productId={reviewProductId}
          productName={reviewProductName}
          onSubmitted={async () => {
            try {
              const prompts = await fetchReviewPromptsApi();
              setPromptIds(new Set(prompts.map(p => p.productId)));
            } catch {
              // ignore
            }
          }}
        />
      )}
    </div>
  );
}
