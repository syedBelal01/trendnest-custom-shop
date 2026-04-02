import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fetchMeApi, logoutApi } from '@/lib/authApi';
import type { User } from '@/types';

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await fetchMeApi();
        if (!mounted) return;
        setUser(u);
      } catch {
        toast.error('Could not load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onLogout = async () => {
    try {
      await logoutApi();
      toast.success('Logged out');
      window.location.href = '/';
    } catch {
      toast.error('Logout failed');
    }
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <div className="py-10 text-center text-muted-foreground">Not logged in</div>;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">My Account</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and orders.</p>
      </div>

      <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Name:</span> {user.name || '—'}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Email:</span> {user.email}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Phone:</span> {user.phone || '—'}
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Password:</span>{' '}
          {user.mustResetPassword ? 'Needs setup' : 'Set'}
        </div>
        {user.mustResetPassword && (
          <div className="pt-2">
            <Link to="/account/settings">
              <Button size="sm" variant="outline">
                Set password
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/account/orders">
          <Button variant="outline" className="w-full justify-start">My Orders</Button>
        </Link>
        <Link to="/account/addresses">
          <Button variant="outline" className="w-full justify-start">Address Book</Button>
        </Link>
        <Link to="/cart">
          <Button variant="outline" className="w-full justify-start">Cart</Button>
        </Link>
        <a href="mailto:trendnest099@gmail.com">
          <Button variant="outline" className="w-full justify-start" type="button">Customer Support</Button>
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/account/orders">
          <Button size="sm" variant="outline">
            View orders
          </Button>
        </Link>
        <Link to="/account/settings">
          <Button size="sm" variant="outline">
            Settings
          </Button>
        </Link>
        <Button size="sm" variant="outline" onClick={() => void onLogout()}>
          Logout
        </Button>
      </div>
    </div>
  );
}

