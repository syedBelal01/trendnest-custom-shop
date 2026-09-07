import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  createVendorCouponApi,
  deleteVendorCouponApi,
  fetchVendorCouponsApi,
  updateVendorCouponApi,
} from '@/lib/vendorCouponsApi';
import { fetchVendorProductsApi } from '@/lib/vendorProductsApi';
import type { Vendor } from '@/lib/vendorsApi';
import type { Coupon, Product } from '@/types';

type OutletCtx = { vendor: Vendor | null };

type FormState = {
  code: string;
  type: 'percentage' | 'flat';
  value: string;
  maxDiscount: string;
  minOrder: string;
  paymentMethodScope: 'online' | 'cod' | 'both';
  productIds: string[];
  startAt: string;
  endAt: string;
  usageTotalLimit: string;
  usagePerUserLimit: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  type: 'percentage',
  value: '10',
  maxDiscount: '',
  minOrder: '0',
  paymentMethodScope: 'both',
  productIds: [],
  startAt: '',
  endAt: '',
  usageTotalLimit: '',
  usagePerUserLimit: '',
  isActive: true,
});

function toDateInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function VendorCouponsPage() {
  const { vendor } = useOutletContext<OutletCtx>();
  const nav = useNavigate();
  const [list, setList] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!vendor) return;
    if (vendor.status !== 'approved') {
      nav('/vendor');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [coupons, prods] = await Promise.all([fetchVendorCouponsApi(), fetchVendorProductsApi()]);
        if (!cancelled) {
          setList(coupons);
          setProducts(prods);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Failed to load coupons');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendor, nav]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code || '',
      type: c.type === 'flat' ? 'flat' : 'percentage',
      value: String(c.value ?? ''),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
      minOrder: String(c.minOrder ?? 0),
      paymentMethodScope:
        c.paymentMethodScope === 'online' || c.paymentMethodScope === 'cod' ? c.paymentMethodScope : 'both',
      productIds: Array.isArray(c.productIds) ? c.productIds.map(String) : [],
      startAt: toDateInput(c.startAt),
      endAt: toDateInput(c.endAt),
      usageTotalLimit: c.usageTotalLimit != null ? String(c.usageTotalLimit) : '',
      usagePerUserLimit: c.usagePerUserLimit != null ? String(c.usagePerUserLimit) : '',
      isActive: c.isActive !== false,
    });
    setOpen(true);
  };

  const payloadFromForm = () => ({
    code: form.code.trim(),
    type: form.type,
    value: Number(form.value),
    maxDiscount: form.maxDiscount === '' ? ('' as const) : Number(form.maxDiscount),
    minOrder: Number(form.minOrder) || 0,
    paymentMethodScope: form.paymentMethodScope,
    productIds: form.productIds,
    startAt: form.startAt || undefined,
    endAt: form.endAt || undefined,
    usageTotalLimit: form.usageTotalLimit === '' ? ('' as const) : Number(form.usageTotalLimit),
    usagePerUserLimit: form.usagePerUserLimit === '' ? ('' as const) : Number(form.usagePerUserLimit),
    isActive: form.isActive,
  });

  const save = async () => {
    if (!form.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    if (!Number.isFinite(Number(form.value)) || Number(form.value) <= 0) {
      toast.error('Enter a valid discount value');
      return;
    }
    setBusy(true);
    try {
      const payload = payloadFromForm();
      if (editingId) {
        const updated = await updateVendorCouponApi(editingId, payload);
        setList((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success('Coupon updated');
      } else {
        const created = await createVendorCouponApi(payload);
        setList((prev) => [created, ...prev]);
        toast.success('Coupon created');
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this coupon?')) return;
    setBusy(true);
    try {
      await deleteVendorCouponApi(id);
      setList((prev) => prev.filter((c) => c.id !== id));
      toast.success('Coupon deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleProduct = (id: string) => {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id],
    }));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading coupons…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create codes for your products only. Discount applies to your items in the cart.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> New coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit coupon' : 'New coupon'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                placeholder="Code (e.g. SAVE10)"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={form.type}
                  onValueChange={(v: 'percentage' | 'flat') => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage %</SelectItem>
                    <SelectItem value="flat">Flat ₹</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder={form.type === 'percentage' ? 'Value %' : 'Value ₹'}
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Max discount ₹ (optional)"
                  value={form.maxDiscount}
                  onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Min order on your items"
                  value={form.minOrder}
                  onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
                />
              </div>
              <Select
                value={form.paymentMethodScope}
                onValueChange={(v: 'online' | 'cod' | 'both') =>
                  setForm((f) => ({ ...f, paymentMethodScope: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Payment scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">COD + Online</SelectItem>
                  <SelectItem value="cod">COD only</SelectItem>
                  <SelectItem value="online">Online only</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={form.startAt}
                  onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                />
                <Input
                  type="date"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder="Total uses (optional)"
                  value={form.usageTotalLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageTotalLimit: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Per user limit (optional)"
                  value={form.usagePerUserLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usagePerUserLimit: e.target.value }))}
                />
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Apply to products</p>
                <p className="text-xs text-muted-foreground">
                  Leave none selected to apply to all your products.
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {products.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No products yet.</p>
                  ) : (
                    products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.productIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Active</span>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              </div>

              <Button type="button" className="w-full" disabled={busy} onClick={() => void save()}>
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create coupon'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Discount</th>
              <th className="text-left p-3">Min</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No coupons yet. Create one for your customers.
                </td>
              </tr>
            )}
            {list.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono font-medium">{c.code}</td>
                <td className="p-3">
                  {c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`}
                  {c.maxDiscount != null ? ` (max ₹${c.maxDiscount})` : ''}
                </td>
                <td className="p-3">₹{c.minOrder || 0}</td>
                <td className="p-3">{c.isActive ? 'Active' : 'Inactive'}</td>
                <td className="p-3">
                  <div className="flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
