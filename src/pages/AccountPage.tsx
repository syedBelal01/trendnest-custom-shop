import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingBag, MapPin, ShoppingCart, Settings, LogOut, Mail, Phone, ChevronRight, Headphones } from 'lucide-react';

const menuItems = [
  { to: '/account/orders', label: 'My Orders', desc: 'Track and manage your orders', icon: ShoppingBag },
  { to: '/account/addresses', label: 'Address Book', desc: 'Manage delivery addresses', icon: MapPin },
  { to: '/cart', label: 'My Cart', desc: 'View items in your cart', icon: ShoppingCart },
  { to: '/account/settings', label: 'Settings', desc: 'Update password & preferences', icon: Settings },
];

export default function AccountPage() {
  const { user, logout } = useAuth();

  const onLogout = async () => {
    try {
      await logout();
      toast.success('Logged out');
      window.location.href = '/';
    } catch {
      toast.error('Logout failed');
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-5">
      {/* Profile card */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{user.name || 'User'}</h1>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Phone className="h-3 w-3 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
            </div>
          </div>
          {user.mustResetPassword && (
            <Link to="/account/settings" className="mt-3 flex items-center gap-2 text-xs text-primary font-medium bg-primary/10 rounded-lg px-3 py-2">
              <Settings className="h-3.5 w-3.5" /> Please set your password
              <ChevronRight className="h-3.5 w-3.5 ml-auto" />
            </Link>
          )}
        </div>
      </div>

      {/* Menu items */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden divide-y">
        {menuItems.map(item => (
          <Link key={item.to} to={item.to} className="flex items-center gap-3.5 p-4 hover:bg-muted/50 transition-colors active:bg-muted/70">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
        <a href="mailto:support@trendnest99.in" className="flex items-center gap-3.5 p-4 hover:bg-muted/50 transition-colors active:bg-muted/70">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Customer Support</div>
            <div className="text-xs text-muted-foreground">Get help via email</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={() => void onLogout()}
        className="w-full h-11 rounded-xl gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
