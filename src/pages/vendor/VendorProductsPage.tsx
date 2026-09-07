import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchVendorProductsApi } from '@/lib/vendorProductsApi';
import type { Vendor } from '@/lib/vendorsApi';
import type { Product } from '@/types';
import { productPrimaryImage } from '@/lib/productImages';

type OutletCtx = { vendor: Vendor | null };

export default function VendorProductsPage() {
  const { vendor } = useOutletContext<OutletCtx>();
  const nav = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!vendor) return;
    if (vendor.status !== 'approved') {
      nav('/vendor');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchVendorProductsApi();
        if (!cancelled) setProducts(list);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendor, nav]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading products…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drafts and under-review listings stay hidden on the store until admin publishes them.
          </p>
        </div>
        <Button asChild>
          <Link to="/vendor/products/new">Add Product</Link>
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">Price</th>
              <th className="text-left p-3">Stock</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No products yet. Click Add Product to create one.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={productPrimaryImage(p)}
                      alt=""
                      className="h-12 w-12 rounded-md object-cover border"
                    />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">{p.sku || '—'}</td>
                <td className="p-3">₹{p.price}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3 capitalize">{p.approvalStatus || 'draft'}</td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/vendor/products/${encodeURIComponent(p.id)}`}>Edit</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
