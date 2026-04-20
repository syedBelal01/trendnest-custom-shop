import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchReviewPromptsApi } from '@/lib/reviewsApi';
import { useProducts } from '@/contexts/ProductsContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const SHOW_DELAY_MS = 10_000;
const AUTO_HIDE_MS = 60_000;
const SUPPRESS_MS = 24 * 60 * 60_000; // once per day per product

function lsKey(productId: string) {
  return `tn_review_popup_last_shown:${productId}`;
}

export default function ReviewReminderPopup() {
  const { products } = useProducts();
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (authLoading || !user) return;

    const delay = window.setTimeout(() => {
      void (async () => {
        try {
          const prompts = await fetchReviewPromptsApi();
          if (!mounted) return;
          const first = prompts.find((p) => p?.productId);
          if (!first?.productId) return;

          const pid = String(first.productId);
          const key = lsKey(pid);
          const last = Number(window.localStorage.getItem(key) || 0);
          if (Number.isFinite(last) && last > 0 && Date.now() - last < SUPPRESS_MS) return;

          window.localStorage.setItem(key, String(Date.now()));
          setProductId(pid);
          setOpen(true);

          window.setTimeout(() => {
            setOpen(false);
          }, AUTO_HIDE_MS);
        } catch {
          // ignore
        }
      })();
    }, SHOW_DELAY_MS);

    return () => {
      mounted = false;
      window.clearTimeout(delay);
    };
  }, [authLoading, user]);

  const productName = useMemo(() => {
    if (!productId) return 'your product';
    return products.find((p) => p.id === productId)?.name || 'your product';
  }, [productId, products]);

  if (!open || !productId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)]">
      <div className="rounded-2xl border bg-card shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">How was {productName}?</div>
            <div className="text-xs text-muted-foreground mt-1">
              If you’ve received it, please leave a quick review.
            </div>
          </div>
          <button
            type="button"
            className="ml-auto p-2 rounded-md hover:bg-muted/60"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button asChild size="sm" className="h-9">
            <Link to="/account/orders">Review now</Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setOpen(false)}>
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}

