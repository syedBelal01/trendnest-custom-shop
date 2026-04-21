import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { verifyReviewInviteApi, submitReviewInviteApi, type ReviewInviteVerifyStatus } from '@/lib/reviewsApi';
import { useProducts } from '@/contexts/ProductsContext';

type VerifyState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      status: ReviewInviteVerifyStatus;
      product?: { id: string; name: string; image?: string };
      expiresAt?: string;
    };

export default function ReviewInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshRatingSummary } = useProducts();
  const [state, setState] = useState<VerifyState>({ kind: 'loading' });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const t = String(token || '').trim();
    if (!t) {
      setState({ kind: 'error', message: 'Missing review token.' });
      return;
    }
    setState({ kind: 'loading' });
    void (async () => {
      try {
        const v = await verifyReviewInviteApi(t);
        if (!mounted) return;
        setState({ kind: 'ready', status: v.status, product: v.product, expiresAt: v.expiresAt });
      } catch (e) {
        if (!mounted) return;
        setState({ kind: 'error', message: e instanceof Error ? e.message : 'Failed to verify link' });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  const title = useMemo(() => {
    if (state.kind !== 'ready') return 'Write a review';
    if (state.status === 'ok') return 'Write a review';
    if (state.status === 'expired') return 'Link expired';
    if (state.status === 'used') return 'Already reviewed';
    if (state.status === 'revoked') return 'Link invalid';
    if (state.status === 'invalid') return 'Link invalid';
    return 'Not eligible';
  }, [state]);

  const submit = async () => {
    const t = String(token || '').trim();
    if (!t) return;
    if (rating < 1 || rating > 5) {
      toast.error('Rating must be 1 to 5');
      return;
    }
    setBusy(true);
    try {
      await submitReviewInviteApi({ token: t, rating, comment: comment.trim() });
      if (state.kind === 'ready' && state.product?.id) {
        await refreshRatingSummary([state.product.id]);
      }
      toast.success('Thanks! Your review was submitted.');
      navigate('/account/orders');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-4 py-6 sm:py-10">
      <div className="rounded-2xl border bg-card shadow-sm p-4 sm:p-6 space-y-4">
        <div className="space-y-1">
          <div className="text-lg font-bold">{title}</div>
          <div className="text-xs text-muted-foreground">
            {state.kind === 'ready' && state.status === 'ok'
              ? 'Rate 1–5 stars and share your experience.'
              : 'Review links are valid for a limited time.'}
          </div>
        </div>

        {state.kind === 'loading' ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Verifying link…
          </div>
        ) : state.kind === 'error' ? (
          <div className="space-y-3">
            <div className="text-sm text-destructive">{state.message}</div>
            <Link to="/" className="text-sm text-primary font-semibold hover:underline">
              Go to home →
            </Link>
          </div>
        ) : state.status !== 'ok' ? (
          <div className="space-y-3">
            <div className="text-sm">
              {state.status === 'expired'
                ? 'This review link has expired.'
                : state.status === 'used'
                  ? 'This review link was already used.'
                  : state.status === 'not_eligible'
                    ? 'You’re not eligible to review with this link.'
                    : 'This review link is not valid.'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => navigate('/')}>
                Continue shopping
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/account/orders')}>
                My orders
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {state.product ? (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
                {state.product.image ? (
                  <img
                    src={state.product.image}
                    alt={state.product.name}
                    className="h-12 w-12 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg border bg-muted" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{state.product.name}</div>
                  {state.expiresAt ? (
                    <div className="text-[11px] text-muted-foreground">
                      Link expires: {new Date(state.expiresAt).toLocaleString('en-IN')}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }, (_, i) => {
                const v = i + 1;
                const active = v <= rating;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRating(v)}
                    disabled={busy}
                    className={`text-3xl leading-none p-1 ${active ? 'text-yellow-500' : 'text-muted-foreground/40'}`}
                    aria-label={`${v} star`}
                  >
                    ★
                  </button>
                );
              })}
            </div>

            <textarea
              className="w-full min-h-[96px] rounded-xl border bg-background px-3 py-2.5 text-sm resize-none"
              placeholder="Write a short comment (optional)"
              value={comment}
              disabled={busy}
              onChange={(e) => setComment(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" disabled={busy} className="h-10" onClick={() => void submit()}>
                Submit review
              </Button>
              <Button type="button" variant="outline" disabled={busy} className="h-10" onClick={() => navigate('/')}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

