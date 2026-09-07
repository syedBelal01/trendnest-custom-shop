import { Link, useOutletContext } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchVendorProductsApi } from '@/lib/vendorProductsApi';
import { fetchVendorOrdersApi } from '@/lib/vendorOrdersApi';
import type { Vendor } from '@/lib/vendorsApi';
import type { Product } from '@/types';

type OutletCtx = { vendor: Vendor | null };

export default function VendorDashboardPage() {
  const { vendor } = useOutletContext<OutletCtx>();
  const [products, setProducts] = useState<Product[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendor) {
      setLoading(false);
      return;
    }
    if (vendor.status !== 'approved') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [list, ordersRes] = await Promise.all([
          fetchVendorProductsApi(),
          fetchVendorOrdersApi().catch(() => ({
            orders: [],
            summary: {
              orderCount: 0,
              productCount: 0,
              pendingEarnings: 0,
              commissionPercent: vendor.commissionPercent,
            },
          })),
        ]);
        if (!cancelled) {
          setProducts(list);
          setOrderCount(ordersRes.summary.orderCount);
          setPendingEarnings(ordersRes.summary.pendingEarnings);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendor]);

  if (!vendor) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold">Vendor Panel</h1>
        <p className="text-sm text-muted-foreground">You have not applied as a vendor yet.</p>
        <Button asChild>
          <Link to="/sell">Apply to Sell on TrendNest</Link>
        </Button>
      </div>
    );
  }

  const approved = vendor.status === 'approved';

  if (loading && approved) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">TrendNest Seller Panel</p>
        <h1 className="text-2xl font-bold">Welcome, {vendor.storeName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Status:{' '}
          <span className={`font-semibold ${approved ? 'text-emerald-600' : 'text-foreground'}`}>
            {vendor.status}
          </span>
        </p>
      </div>

      {vendor.status === 'pending' && (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Your application is under review. Product listing tools will unlock after admin approval.
        </div>
      )}

      {vendor.status === 'rejected' && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3 text-sm">
          <p>Application rejected{vendor.rejectionReason ? `: ${vendor.rejectionReason}` : '.'}</p>
          <Button asChild variant="secondary">
            <Link to="/sell">Update & re-apply</Link>
          </Button>
        </div>
      )}

      {vendor.status === 'suspended' && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
          Your seller account is suspended. Contact support for help.
        </div>
      )}

      {approved && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Products</div>
              <div className="text-xl font-bold mt-1">{products.length}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Orders</div>
              <div className="text-xl font-bold mt-1">{orderCount}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Pending earnings</div>
              <div className="text-xl font-bold mt-1">₹{pendingEarnings}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Commission</div>
              <div className="text-xl font-bold mt-1">{vendor.commissionPercent}%</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="font-semibold">Quick actions</h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/vendor/products/new">Add Product</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/vendor/products">Manage Products</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/vendor/orders">View Orders</Link>
              </Button>
            </div>
            {products.length > 0 && (
              <ul className="mt-2 divide-y border rounded-xl overflow-hidden text-sm">
                {products.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-background">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {p.approvalStatus || 'draft'} · ₹{p.price}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/vendor/products/${encodeURIComponent(p.id)}`}>Edit</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 text-sm space-y-1">
            <h2 className="font-semibold text-base mb-2">Store profile</h2>
            <p><span className="text-muted-foreground">Email:</span> {vendor.contactEmail || '—'}</p>
            <p><span className="text-muted-foreground">Phone:</span> {vendor.contactPhone || '—'}</p>
            <p>
              <span className="text-muted-foreground">City:</span> {vendor.city || '—'}
              {vendor.state ? `, ${vendor.state}` : ''}
            </p>
            <p><span className="text-muted-foreground">GSTIN:</span> {vendor.gstin || '—'}</p>
            <p>
              <span className="text-muted-foreground">Bank:</span> {vendor.bankName || '—'} ·{' '}
              {vendor.bankAccountNumberMasked || '—'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
