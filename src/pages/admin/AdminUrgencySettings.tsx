import { useEffect, useMemo, useState } from 'react';
import { Flame, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useProducts } from '@/contexts/ProductsContext';
import {
  createAdminUrgencySettingApi,
  deleteAdminUrgencySettingApi,
  fetchAdminUrgencySettingsApi,
  updateAdminUrgencySettingApi,
  type ProductUrgencyInput,
} from '@/lib/productUrgencyApi';
import type { ProductUrgencyScope, ProductUrgencySetting } from '@/types';

type FormState = {
  enabled: boolean;
  scope: ProductUrgencyScope;
  categoryId: string;
  productId: string;
  dealTitle: string;
  discountText: string;
  startDate: string;
  endDate: string;
  stockText: string;
  soldCountText: string;
  viewerCountText: string;
  badgeText: string;
  priority: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalInputValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function defaultForm(): FormState {
  const now = new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    enabled: true,
    scope: 'all',
    categoryId: '',
    productId: '',
    dealTitle: 'Limited Time Deal',
    discountText: '',
    startDate: toLocalInputValue(now.toISOString()),
    endDate: toLocalInputValue(end.toISOString()),
    stockText: 'Only 7 left',
    soldCountText: '128 sold in last 24h',
    viewerCountText: '214 people are viewing this product',
    badgeText: 'Trending',
    priority: '100',
  };
}

function formFromSetting(row: ProductUrgencySetting): FormState {
  return {
    enabled: row.enabled,
    scope: row.scope,
    categoryId: row.categoryId || '',
    productId: row.productId || '',
    dealTitle: row.dealTitle || 'Limited Time Deal',
    discountText: row.discountText || '',
    startDate: toLocalInputValue(row.startDate),
    endDate: toLocalInputValue(row.endDate),
    stockText: row.stockText || '',
    soldCountText: row.soldCountText || '',
    viewerCountText: row.viewerCountText || '',
    badgeText: row.badgeText || '',
    priority: String(row.priority ?? 100),
  };
}

function payloadFromForm(form: FormState): ProductUrgencyInput {
  const startDate = localInputToIso(form.startDate);
  const endDate = localInputToIso(form.endDate);
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) throw new Error('End date must be after start date');
  if (form.scope === 'category' && !form.categoryId.trim()) throw new Error('Choose a category');
  if (form.scope === 'product' && !form.productId.trim()) throw new Error('Choose a product');
  return {
    enabled: form.enabled,
    scope: form.scope,
    categoryId: form.scope === 'category' ? form.categoryId.trim() : undefined,
    productId: form.scope === 'product' ? form.productId.trim() : undefined,
    dealTitle: form.dealTitle.trim() || 'Limited Time Deal',
    discountText: form.discountText.trim(),
    startDate,
    endDate,
    stockText: form.stockText.trim(),
    soldCountText: form.soldCountText.trim(),
    viewerCountText: form.viewerCountText.trim(),
    badgeText: form.badgeText.trim(),
    priority: Number.isFinite(Number(form.priority)) ? Math.floor(Number(form.priority)) : 100,
  };
}

export default function AdminUrgencySettings() {
  const { products } = useProducts();
  const [rows, setRows] = useState<ProductUrgencySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState<FormState>(defaultForm);

  const categories = useMemo(
    () => Array.from(new Set(products.flatMap((p) => [p.category, ...(p.categories || [])]).filter(Boolean))).sort(),
    [products]
  );

  const productOptions = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
      .slice(0, 60);
  }, [products, productSearch]);

  const loadRows = async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminUrgencySettingsApi());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load urgency settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setForm(defaultForm());
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (editId) await updateAdminUrgencySettingApi(editId, payload);
      else await createAdminUrgencySettingApi(payload);
      toast.success(editId ? 'Urgency setting updated' : 'Urgency setting created');
      resetForm();
      await loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save urgency setting');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this urgency setting?')) return;
    try {
      await deleteAdminUrgencySettingApi(id);
      toast.success('Urgency setting deleted');
      if (editId === id) resetForm();
      await loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete urgency setting');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Flame className="h-6 w-6 text-orange-600" /> Urgency Settings
          </h1>
          <p className="text-sm text-muted-foreground">Control Product Page Urgency by all products, category, or specific product.</p>
        </div>
        <Button variant="outline" onClick={resetForm} className="gap-2">
          <Plus className="h-4 w-4" /> New Setting
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4 font-semibold">Active Rules</div>
          <div className="divide-y">
            {loading ? <div className="p-4 text-sm text-muted-foreground">Loading...</div> : null}
            {!loading && rows.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No urgency settings yet.</div> : null}
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.dealTitle}</span>
                    <Badge variant={row.enabled ? 'default' : 'secondary'}>{row.enabled ? 'Enabled' : 'Disabled'}</Badge>
                    <Badge variant="outline">{row.scope}</Badge>
                    <Badge variant="outline">Priority {row.priority}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.scope === 'product' ? row.productId : row.scope === 'category' ? row.categoryId : 'All products'} | {new Date(row.startDate).toLocaleString()} - {new Date(row.endDate).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditId(row.id); setForm(formFromSetting(row)); }}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editId ? 'Edit Setting' : 'New Setting'}</h2>
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => ({ ...f, enabled }))} />
              Enabled
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={(scope: ProductUrgencyScope) => setForm((f) => ({ ...f, scope }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="category">Category-wise Products</SelectItem>
                  <SelectItem value="product">Specific Product</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.scope === 'category' ? (
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}>
                  <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : null}

            {form.scope === 'product' ? (
              <div className="grid gap-2">
                <Label>Product</Label>
                <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search product..." />
                <Select value={form.productId} onValueChange={(productId) => setForm((f) => ({ ...f, productId }))}>
                  <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                  <SelectContent>{productOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Deal title" value={form.dealTitle} onChange={(dealTitle) => setForm((f) => ({ ...f, dealTitle }))} />
              <Field label="Discount text" value={form.discountText} onChange={(discountText) => setForm((f) => ({ ...f, discountText }))} placeholder="67% OFF" />
              <Field label="Start date/time" type="datetime-local" value={form.startDate} onChange={(startDate) => setForm((f) => ({ ...f, startDate }))} />
              <Field label="End date/time" type="datetime-local" value={form.endDate} onChange={(endDate) => setForm((f) => ({ ...f, endDate }))} />
              <Field label="Stock urgency" value={form.stockText} onChange={(stockText) => setForm((f) => ({ ...f, stockText }))} />
              <Field label="Sold count" value={form.soldCountText} onChange={(soldCountText) => setForm((f) => ({ ...f, soldCountText }))} />
              <Field label="Viewer count" value={form.viewerCountText} onChange={(viewerCountText) => setForm((f) => ({ ...f, viewerCountText }))} />
              <Field label="Badge text" value={form.badgeText} onChange={(badgeText) => setForm((f) => ({ ...f, badgeText }))} />
              <Field label="Priority" type="number" value={form.priority} onChange={(priority) => setForm((f) => ({ ...f, priority }))} />
            </div>

            <Button onClick={() => void save()} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Setting'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{props.label}</Label>
      <Input
        type={props.type || 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
