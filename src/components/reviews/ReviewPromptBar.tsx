import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { dismissReviewPromptApi, fetchReviewPromptsApi } from '@/lib/reviewsApi';
import { useProducts } from '@/contexts/ProductsContext';
import { useAuth } from '@/contexts/AuthContext';

export default function ReviewPromptBar() {
  const { products } = useProducts();
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (authLoading || !user) return;
        const prompts = await fetchReviewPromptsApi();
        if (!mounted) return;
        const first = prompts[0];
        if (!first?.productId) return;
        setProductId(first.productId);
        setOpen(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  const productName = useMemo(() => {
    if (!productId) return 'your product';
    return products.find(p => p.id === productId)?.name || 'your product';
  }, [productId, products]);

  if (!open || !productId) return null;

  return (
    <div className="border-b bg-primary/5">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-start sm:items-center gap-3">
        <div className="text-sm">
          <div className="font-semibold">You recently purchased {productName}.</div>
          <div className="text-xs text-muted-foreground">
            If you like it, please give us a 5-star rating.
            <Link to={`/product/${productId}`} className="ml-2 text-primary font-semibold hover:underline">
              Write a review
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="ml-auto p-2 rounded-md hover:bg-muted/60"
          aria-label="Dismiss"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void (async () => {
              try {
                await dismissReviewPromptApi(productId);
              } finally {
                setOpen(false);
                setBusy(false);
              }
            })();
          }}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

