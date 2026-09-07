import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Package, PlusCircle, ShoppingBag, Store } from 'lucide-react';
import { toast } from 'sonner';
import UserGuard from '@/components/UserGuard';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyVendorApi, type Vendor } from '@/lib/vendorsApi';

const links = [
  { to: '/vendor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/vendor/products', label: 'Products', icon: Package, end: true },
  { to: '/vendor/products/new', label: 'Add Product', icon: PlusCircle, end: true },
  { to: '/vendor/orders', label: 'Orders', icon: ShoppingBag, end: true },
];

function VendorShell() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      nav(`/login?redirect=${encodeURIComponent('/vendor')}`);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const v = await fetchMyVendorApi();
        if (!cancelled) setVendor(v);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load vendor');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, nav]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading seller panel…
      </div>
    );
  }

  const approved = vendor?.status === 'approved';
  const navLinks = approved ? links : [{ to: '/vendor', label: 'Dashboard', icon: LayoutDashboard, end: true }];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r bg-card md:flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b">
          <Link to="/" className="font-bold text-lg">
            Trend<span className="text-primary">Nest</span>99
          </Link>
          <p className="text-xs text-muted-foreground">Seller Panel</p>
          {vendor?.storeName ? (
            <p className="text-xs mt-1 flex items-center gap-1 text-foreground/80 truncate">
              <Store className="h-3 w-3 shrink-0" />
              {vendor.storeName}
            </p>
          ) : null}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => {
                let active = isActive;
                if (l.to === '/vendor/products') {
                  active =
                    location.pathname === '/vendor/products' ||
                    (location.pathname.startsWith('/vendor/products/') &&
                      !location.pathname.endsWith('/new'));
                }
                return `flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`;
              }}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground w-full rounded-md hover:bg-accent"
          >
            Back to store
          </Link>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <div className="md:hidden border-b p-2 sm:p-3 flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => {
                let active = isActive;
                if (l.to === '/vendor/products') {
                  active =
                    location.pathname === '/vendor/products' ||
                    (location.pathname.startsWith('/vendor/products/') &&
                      !location.pathname.endsWith('/new'));
                }
                return `flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs rounded-md whitespace-nowrap shrink-0 ${
                  active ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
                }`;
              }}
            >
              <l.icon className="h-3 w-3" />
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="p-3 sm:p-4 md:p-6">
          <Outlet context={{ vendor }} />
        </div>
      </div>
    </div>
  );
}

export default function VendorLayout() {
  return (
    <UserGuard>
      <VendorShell />
    </UserGuard>
  );
}
