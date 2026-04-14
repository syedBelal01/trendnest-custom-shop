import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useEffect, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const LAST_ORDER_ID_KEY = 'tn:last_order_id_v1';

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 220}ms`,
        duration: `${900 + Math.random() * 550}ms`,
        rotate: `${Math.floor(Math.random() * 360)}deg`,
        hue: Math.floor(180 + Math.random() * 140),
      })),
    []
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes tnConfettiDrop {
          0% { transform: translate3d(0,-16px,0) rotate(var(--r)); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(0,110vh,0) rotate(calc(var(--r) + 220deg)); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: p.left,
            animation: `tnConfettiDrop ${p.duration} cubic-bezier(.2,.8,.2,1) ${p.delay} both`,
            ['--r' as any]: p.rotate,
            background: `hsl(${p.hue} 90% 55%)`,
          }}
          className="absolute top-0 h-2.5 w-1.5 rounded-sm"
        />
      ))}
    </div>
  );
}

export default function CheckoutSuccessPage() {
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const orderId = (() => {
    const fromState = (location.state as any)?.orderId;
    if (typeof fromState === 'string' && fromState.trim()) return fromState.trim();
    const fromStorage = sessionStorage.getItem(LAST_ORDER_ID_KEY);
    return fromStorage && fromStorage.trim() ? fromStorage.trim() : null;
  })();

  useEffect(() => {
    // Ensure cart is cleared even if user refreshes success page.
    clearCart();
  }, [clearCart]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)]">
      <ConfettiBurst />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border bg-card p-6 sm:p-10 text-center shadow-sm">
          <style>{`
            @keyframes tnPopIn { 0% { transform: scale(.96); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            @keyframes tnFadeUp { 0% { transform: translateY(6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
          `}</style>

          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
            style={{ animation: 'tnPopIn 360ms cubic-bezier(.2,.8,.2,1) both' }}
          >
            <CheckCircle2 className="h-9 w-9 text-primary" />
          </div>

          <div style={{ animation: 'tnFadeUp 420ms 60ms ease-out both' }}>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Order Placed Successfully</h1>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">Your order has been confirmed.</p>
            {orderId && (
              <p className="mt-4 text-xs sm:text-sm text-muted-foreground">
                Order ID:{' '}
                <span className="font-mono font-semibold text-foreground break-all">{orderId}</span>
              </p>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4" style={{ animation: 'tnFadeUp 420ms 120ms ease-out both' }}>
            <Button onClick={() => navigate('/', { replace: true })} className="h-11">
              Continue Shopping
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link to="/account/orders" replace>
                View Orders
              </Link>
            </Button>
          </div>

          <div className="mt-5 text-xs text-muted-foreground" style={{ animation: 'tnFadeUp 420ms 170ms ease-out both' }}>
            You can safely close this page.
          </div>
        </div>
      </div>
    </div>
  );
}

