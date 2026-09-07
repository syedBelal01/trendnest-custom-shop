import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyVendorApi } from '@/lib/vendorsApi';
import {
  createVendorProductApi,
  fetchVendorProductsApi,
  updateVendorProductApi,
} from '@/lib/vendorProductsApi';
import { ADMIN_MAIN_CATEGORIES, ADMIN_CATEGORY_TREE } from '@/data/adminCategories';
import { uploadProductImage } from '@/lib/api';
import { processProductImageFile } from '@/lib/processProductImage';
import type { Product } from '@/types';

export default function VendorProductEditPage() {
  const { productId } = useParams<{ productId: string }>();
  const isNew = !productId || productId === 'new';
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existing, setExisting] = useState<Product | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'fashion',
    subcategory: '',
    sku: '',
    price: '',
    originalPrice: '',
    onlinePrice: '',
    stock: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      nav(`/login?redirect=${encodeURIComponent(isNew ? '/vendor/products/new' : `/vendor/products/${productId}`)}`);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const vendor = await fetchMyVendorApi();
        if (!vendor || vendor.status !== 'approved') {
          if (!cancelled) nav('/vendor');
          return;
        }
        if (!isNew && productId) {
          const list = await fetchVendorProductsApi();
          const hit = list.find((p) => p.id === productId) || null;
          if (!hit) {
            toast.error('Product not found');
            nav('/vendor/products');
            return;
          }
          if (!cancelled) {
            setExisting(hit);
            const imgs = (hit.images || []).map((u) => String(u).trim()).filter(Boolean).slice(0, 8);
            setImages(imgs);
            setPrimaryIndex(0);
            setForm({
              name: hit.name || '',
              description: hit.description || '',
              category: hit.category || 'fashion',
              subcategory: hit.subcategory || '',
              sku: hit.sku || '',
              price: hit.price != null ? String(hit.price) : '',
              originalPrice: hit.originalPrice != null ? String(hit.originalPrice) : '',
              onlinePrice: hit.onlinePrice != null ? String(hit.onlinePrice) : '',
              stock: hit.stock != null ? String(hit.stock) : '',
            });
          }
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, nav, isNew, productId]);

  const subcats = ((ADMIN_CATEGORY_TREE as any)[form.category] as string[] | undefined) || [];

  const orderedImages = () => {
    if (!images.length) return [] as string[];
    const idx = Math.min(Math.max(0, primaryIndex), images.length - 1);
    return [images[idx], ...images.filter((_, i) => i !== idx)];
  };

  const onUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length && images.length + uploaded.length < 8; i++) {
        const dataUrl = await processProductImageFile(files[i], { maxEdge: 1200, quality: 0.85 });
        const blob = await (await fetch(dataUrl)).blob();
        const url = await uploadProductImage(blob, `vendor-${Date.now()}-${i}.jpg`);
        uploaded.push(url);
      }
      if (!uploaded.length) {
        toast.message('Maximum 8 images allowed');
        return;
      }
      setImages((prev) => [...prev, ...uploaded].slice(0, 8));
      toast.success(`Uploaded ${uploaded.length} image(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeImageAt = (idx: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPrimaryIndex((p) => {
        if (next.length === 0) return 0;
        if (idx === p) return 0;
        if (idx < p) return Math.max(0, p - 1);
        return Math.min(p, next.length - 1);
      });
      return next;
    });
    toast.success('Image removed');
  };

  const payloadFromForm = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    subcategory: form.subcategory.trim(),
    sku: form.sku.trim(),
    price: Number(form.price),
    originalPrice: form.originalPrice === '' ? ('' as const) : Number(form.originalPrice),
    onlinePrice: form.onlinePrice === '' ? ('' as const) : Number(form.onlinePrice),
    stock: form.stock === '' ? 0 : Number(form.stock),
    images: orderedImages(),
  });

  const save = async (submitAction: 'draft' | 'submit') => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) {
      toast.error('Enter a valid selling price');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...payloadFromForm(), submitAction };
      if (isNew) {
        const p = await createVendorProductApi(payload);
        toast.success(submitAction === 'submit' ? 'Submitted for review' : 'Draft saved');
        nav(`/vendor/products/${encodeURIComponent(p.id)}`);
      } else if (productId) {
        const p = await updateVendorProductApi(productId, payload);
        setExisting(p);
        const imgs = (p.images || []).map((u) => String(u).trim()).filter(Boolean).slice(0, 8);
        setImages(imgs);
        setPrimaryIndex(0);
        toast.success(submitAction === 'submit' ? 'Submitted for review' : 'Saved');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <div>
        <Link to="/vendor/products" className="text-xs text-muted-foreground hover:text-foreground">← My Products</Link>
        <h1 className="text-2xl font-bold mt-1">{isNew ? 'Add Product' : 'Edit Product'}</h1>
        {existing?.approvalStatus && (
          <p className="text-sm text-muted-foreground mt-1">
            Status: <span className="capitalize font-medium text-foreground">{existing.approvalStatus}</span>
            {existing.rejectionReason ? ` — ${existing.rejectionReason}` : ''}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Input placeholder="Product name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            value={form.category}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v, subcategory: '' }))}
          >
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {ADMIN_MAIN_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={form.subcategory || undefined}
            onValueChange={(v) => setForm((f) => ({ ...f, subcategory: v }))}
          >
            <SelectTrigger><SelectValue placeholder="Subcategory" /></SelectTrigger>
            <SelectContent>
              {subcats.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
          <Input type="number" placeholder="Selling price (COD) *" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          <Input type="number" placeholder="MRP / original price" value={form.originalPrice} onChange={(e) => setForm((f) => ({ ...f, originalPrice: e.target.value }))} />
          <Input type="number" placeholder="Online price (optional)" value={form.onlinePrice} onChange={(e) => setForm((f) => ({ ...f, onlinePrice: e.target.value }))} />
          <Input type="number" placeholder="Stock" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
        </div>

        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Images (up to 8)</p>
              <p className="text-xs text-muted-foreground">Upload from gallery — same process as TrendNest admin. Tap an image to set primary.</p>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void onUploadFiles(e)}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={uploading || images.length >= 8}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : images.length ? 'Add more' : 'Upload images'}
              </Button>
            </div>
          </div>

          {images.length === 0 ? (
            <div className="text-sm text-muted-foreground">No images yet. Choose photos from your gallery.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {images.map((src, idx) => (
                <button
                  key={src + idx}
                  type="button"
                  className={`relative rounded-lg overflow-hidden border ${idx === primaryIndex ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setPrimaryIndex(idx)}
                  title={idx === primaryIndex ? 'Primary image' : 'Set as primary'}
                >
                  <img src={src} alt="" className="w-full h-28 object-cover" />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeImageAt(idx);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        removeImageAt(idx);
                      }
                    }}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                    aria-label="Delete image"
                    title="Delete image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                  <div className="absolute bottom-1 left-1 text-[10px] bg-background/90 px-1.5 py-0.5 rounded">
                    {idx === primaryIndex ? 'Primary' : 'Tap to set primary'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" disabled={saving || uploading} onClick={() => void save('draft')}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button type="button" disabled={saving || uploading} onClick={() => void save('submit')}>
            {saving ? 'Saving…' : 'Submit for review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
