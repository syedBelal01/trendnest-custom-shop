import { Link, Outlet, useLocation } from 'react-router-dom';
import AdminGuard from '@/components/AdminGuard';
import { LayoutDashboard, Package, ShoppingBag, Tag, Palette, Users, LogOut } from 'lucide-react';

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/custom-prints', label: 'Custom Prints', icon: Palette },
  { to: '/admin/customers', label: 'Customers', icon: Users },
];

export default function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <AdminGuard>
      <div className="min-h-screen flex bg-background">
        <aside className="w-56 border-r bg-card hidden md:flex flex-col shrink-0">
          <div className="p-4 border-b">
            <Link to="/" className="font-bold text-lg">Trend<span className="text-primary">Nest</span>99</Link>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {links.map(l => (
              <Link key={l.to} to={l.to} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors ${pathname === l.to ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}>
                <l.icon className="h-4 w-4" />{l.label}
              </Link>
            ))}
          </nav>
          <div className="p-2 border-t">
            <button onClick={() => { sessionStorage.removeItem('admin-auth'); window.location.reload(); }} className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground w-full rounded-md hover:bg-accent">
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </aside>
        <div className="flex-1 overflow-auto">
          {/* Mobile nav */}
          <div className="md:hidden border-b p-3 flex gap-2 overflow-x-auto">
            {links.map(l => (
              <Link key={l.to} to={l.to} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${pathname === l.to ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'}`}>
                <l.icon className="h-3 w-3" />{l.label}
              </Link>
            ))}
          </div>
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </AdminGuard>
  );
}
