import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const HIDE_PATH_PREFIXES = ['/admin', '/cart', '/checkout'];

function shouldHideFloatingCart(pathname: string): boolean {
  const p = String(pathname || '').toLowerCase();
  return HIDE_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export default function FloatingCartAccess() {
  const { itemCount } = useCart();
  const location = useLocation();

  if (itemCount <= 0) return null;
  if (shouldHideFloatingCart(location.pathname)) return null;

  const itemsLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <>
      <Link
        to="/cart"
        className="fixed bottom-6 right-6 z-[58] hidden items-center gap-3 rounded-full border border-orange-200 bg-white px-4 py-3 shadow-lg shadow-orange-100 transition hover:-translate-y-0.5 hover:shadow-xl md:flex"
        aria-label={`Open cart (${itemsLabel})`}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700">
          <ShoppingCart className="h-5 w-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-xs font-semibold uppercase tracking-wide text-orange-700">Cart</span>
          <span className="block text-sm font-bold text-slate-900">{itemsLabel}</span>
        </span>
      </Link>

      <Link
        to="/cart"
        className="fixed bottom-3 left-3 right-3 z-[58] flex items-center justify-between rounded-2xl bg-orange-600 px-4 py-3 text-white shadow-xl shadow-orange-600/30 md:hidden"
        aria-label={`Open cart (${itemsLabel})`}
      >
        <span className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          <span className="text-sm font-bold">View Cart</span>
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{itemsLabel}</span>
      </Link>
    </>
  );
}
