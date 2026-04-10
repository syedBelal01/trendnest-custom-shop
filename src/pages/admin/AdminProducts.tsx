import { useMemo, useRef, useState } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import { Product, ProductVariantOption } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Edit, Plus, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { processProductImageFile } from '@/lib/processProductImage';
import { ProductSpecificationsCard } from '@/components/admin/ProductSpecificationsCard';
import { VariantOptionsCard } from '@/components/admin/VariantOptionsCard';
import { createProductDraftApi } from '@/lib/adminDraftsApi';
import { useNavigate } from 'react-router-dom';
import {
  uploadProductImage,
  ensureProductImageUrls,
  ensureVariantOptionsImageUrls,
  DEFAULT_PRODUCT_IMAGE,
  updateProductApi,
} from '@/lib/api';
import { productPrimaryImage } from '@/lib/productImages';
import { suggestedSpecLabelsForCategory } from '@/data/productSpecPresets';

type StockStatus = 'in' | 'low' | 'out';
function stockStatus(n: number): StockStatus {
  const x = Number(n) || 0;
  if (x <= 0) return 'out';
  if (x <= 5) return 'low';
  return 'in';
}
function stockStatusLabel(s: StockStatus): string {
  if (s === 'out') return 'Out of Stock';
  if (s === 'low') return 'Low Stock';
  return 'In Stock';
}
function stockBadgeClass(s: StockStatus): string {
  if (s === 'out') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (s === 'low') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
}

function normalizeSpecsForPersist(rows: { label: string; value: string }[] | undefined) {
  if (!rows?.length) return [];
  return rows
    .map(r => ({ label: (r.label ?? '').trim(), value: (r.value ?? '').trim() }))
    .filter(r => r.label.length > 0 && r.value.length > 0);
}

const emptyProduct = (): Partial<Product> => ({
  name: '',
  description: '',
  price: 0,
  originalPrice: undefined,
  images: [],
  category: 'fashion',
  subcategory: '',
  stock: 0,
  rating: 4,
  reviews: [],
  sizes: [],
  sleeveTypes: [],
  tags: [],
  specifications: [],
  isCustomPrint: false,
  isTrending: false,
  /** Same variant-card layout for every product: at least one row to add name + images. */
  variantOptions: [{ name: '', images: [] }],
});

const PRESETS: Record<string, Partial<Product>> = {
  belt: {
    category: 'fashion',
    subcategory: 'Belts',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
    variantOptions: [
      { name: 'Black', images: [] },
      { name: 'Brown', images: [] },
      { name: 'Tan', images: [] },
      { name: 'Burgundy', images: [] },
    ],
    sleeveTypes: [],
    isCustomPrint: false,
  },
  soap: {
    category: 'home',
    subcategory: 'Bath',
    sizes: [],
    variantOptions: [
      { name: 'White Marble', images: [] },
      { name: 'Black Marble', images: [] },
      { name: 'Matte Silver', images: [] },
    ],
    sleeveTypes: [],
    isCustomPrint: false,
  },
  printedTee: {
    category: 'printed',
    subcategory: 'Printed Tees',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variantOptions: [
      { name: 'White', images: [] },
      { name: 'Black', images: [] },
      { name: 'Gray', images: [] },
    ],
    sleeveTypes: ['Half sleeve', 'Full sleeve'],
    isCustomPrint: false,
  },
  printedCup: {
    category: 'printed',
    subcategory: 'Printed Cups',
    sizes: [],
    variantOptions: [
      { name: 'White', images: [] },
      { name: 'Black', images: [] },
    ],
    sleeveTypes: [],
    isCustomPrint: false,
  },
  customTee: {
    category: 'printed',
    subcategory: 'Custom Print',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variantOptions: [
      { name: 'White', images: [] },
      { name: 'Black', images: [] },
      { name: 'Gray', images: [] },
    ],
    sleeveTypes: ['Half sleeve', 'Full sleeve'],
    isCustomPrint: true,
  },
  customCup: {
    category: 'printed',
    subcategory: 'Custom Print',
    sizes: [],
    variantOptions: [
      { name: 'White', images: [] },
      { name: 'Black', images: [] },
    ],
    sleeveTypes: [],
    isCustomPrint: true,
  },
};

function normalizeProductForEditing(p: Product): Partial<Product> {
  const specifications = [...(p.specifications ?? [])].map(s => ({
    label: s.label ?? '',
    value: s.value ?? '',
  }));
  if (p.variantOptions?.length) {
    return {
      ...p,
      specifications,
      variantOptions: p.variantOptions.map(v => ({
        name: v.name,
        images: [...(v.images ?? [])],
      })),
    };
  }
  if (p.variants?.length) {
    return {
      ...p,
      specifications,
      variantOptions: p.variants.map((name, i) => ({
        name,
        images: i === 0 ? [...(p.images ?? [])] : [],
      })),
    };
  }
  return {
    ...p,
    specifications,
    variantOptions: [{ name: '', images: [...(p.images ?? [])] }],
  };
}

function optionsSummary(p: Product): string {
  const bits: string[] = [];
  if (p.sizes?.length) bits.push(`${p.sizes.length} sizes`);
  const vCount = p.variantOptions?.length ?? p.variants?.length ?? 0;
  if (vCount) bits.push(`${vCount} variants`);
  if (p.sleeveTypes?.length) bits.push(`${p.sleeveTypes.length} sleeve`);
  if (p.isCustomPrint) bits.push('custom');
  return bits.join(', ') || '—';
}

// VariantThumbImg moved into VariantOptionsCard (keeps UI consistent across admin flows).

export default function AdminProducts() {
  const navigate = useNavigate();
  const { products, addProduct, updateProduct, deleteProduct, apiAvailable, apiIssue, loading, refreshProducts } = useProducts();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [open, setOpen] = useState(false);
  const [maxEdge, setMaxEdge] = useState(1000);
  const [qualityPct, setQualityPct] = useState(85);
  const [imageBusy, setImageBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [specSaveBusy, setSpecSaveBusy] = useState(false);
  const variantFileRef = useRef<HTMLInputElement>(null);
  const variantUploadIdxRef = useRef<number | null>(null);
  const [variantUrlDraft, setVariantUrlDraft] = useState<Record<number, string>>({});

  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'name' | 'price' | 'stock' | 'updated'>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const openVariantUpload = (vidx: number) => {
    variantUploadIdxRef.current = vidx;
    variantFileRef.current?.click();
  };

  const handleVariantImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    const vidx = variantUploadIdxRef.current;
    variantUploadIdxRef.current = null;
    if (!files.length || !editing || vidx === null) return;
    setImageBusy(true);
    try {
      const appended: string[] = [];
      let anyDeferred = false;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await processProductImageFile(file, {
          maxEdge,
          quality: qualityPct / 100,
        });
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const url = await uploadProductImage(blob, `product-${Date.now()}-v${vidx}-${i}.jpg`);
          appended.push(url);
        } catch {
          appended.push(dataUrl);
          anyDeferred = true;
        }
      }
      setEditing(p => {
        if (!p) return p;
        const opts = [...(p.variantOptions ?? [{ name: '', images: [] as string[] }])];
        while (opts.length <= vidx) opts.push({ name: '', images: [] });
        opts[vidx] = {
          ...opts[vidx],
          images: [...(opts[vidx].images ?? []).map(s => s.trim()).filter(Boolean), ...appended],
        };
        return { ...p, variantOptions: opts };
      });
      if (anyDeferred) {
        toast.message(
          `${appended.length} image(s) prepared locally. Save uploads data URLs when API + Cloudinary are ready.`,
          { duration: 6000 }
        );
      } else {
        toast.success(`Uploaded ${appended.length} image(s) for this variant.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process images');
    } finally {
      setImageBusy(false);
    }
  };

  const removeVariantImageAt = (vidx: number, imgIdx: number) => {
    setEditing(p => {
      if (!p) return p;
      const opts = [...(p.variantOptions ?? [{ name: '', images: [] as string[] }])];
      if (!opts[vidx]) return p;
      opts[vidx] = {
        ...opts[vidx],
        images: (opts[vidx].images ?? []).filter((_, j) => j !== imgIdx),
      };
      return { ...p, variantOptions: opts };
    });
  };

  const updateVariantName = (vidx: number, name: string) => {
    setEditing(p => {
      if (!p) return p;
      const opts = [...(p.variantOptions ?? [{ name: '', images: [] as string[] }])];
      while (opts.length <= vidx) opts.push({ name: '', images: [] });
      opts[vidx] = { ...opts[vidx], name };
      return { ...p, variantOptions: opts };
    });
  };

  const addVariantRow = () => {
    setEditing(p =>
      p
        ? {
            ...p,
            variantOptions: [...(p.variantOptions ?? [{ name: '', images: [] as string[] }]), { name: '', images: [] }],
          }
        : p
    );
  };

  const removeVariantRow = (vidx: number) => {
    setEditing(p => {
      if (!p) return p;
      const cur = p.variantOptions ?? [{ name: '', images: [] }];
      if (cur.length <= 1) {
        return { ...p, variantOptions: [{ name: '', images: [] }] };
      }
      const opts = cur.filter((_, i) => i !== vidx);
      return { ...p, variantOptions: opts };
    });
    setVariantUrlDraft(d => {
      const next = { ...d };
      delete next[vidx];
      return next;
    });
  };

  const addVariantImageUrl = (vidx: number) => {
    const u = (variantUrlDraft[vidx] ?? '').trim();
    if (!u || !editing) return;
    setEditing(p => {
      if (!p) return p;
      const opts = [...(p.variantOptions ?? [{ name: '', images: [] as string[] }])];
      while (opts.length <= vidx) opts.push({ name: '', images: [] });
      opts[vidx] = {
        ...opts[vidx],
        images: [...(opts[vidx].images ?? []).map(s => s.trim()).filter(Boolean), u],
      };
      return { ...p, variantOptions: opts };
    });
    setVariantUrlDraft(d => ({ ...d, [vidx]: '' }));
    toast.success('Image URL added for this variant');
  };

  const applyPreset = (key: keyof typeof PRESETS) => {
    setEditing(prev => ({ ...emptyProduct(), ...prev, ...PRESETS[key] }));
  };

  const updateSpecRow = (idx: number, field: 'label' | 'value', value: string) => {
    setEditing(p => {
      if (!p) return p;
      const rows = [...(p.specifications ?? [])];
      while (rows.length <= idx) rows.push({ label: '', value: '' });
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...p, specifications: rows };
    });
  };

  const addSpecRow = () => {
    setEditing(p =>
      p ? { ...p, specifications: [...(p.specifications ?? []), { label: '', value: '' }] } : p
    );
  };

  const removeSpecRow = (idx: number) => {
    setEditing(p => {
      if (!p) return p;
      const rows = (p.specifications ?? []).filter((_, i) => i !== idx);
      return { ...p, specifications: rows };
    });
  };

  const addSuggestedSpecFields = () => {
    setEditing(p => {
      if (!p) return p;
      const cat = p.category ?? 'fashion';
      const labels = suggestedSpecLabelsForCategory(cat);
      const existing = new Set(
        (p.specifications ?? []).map(s => s.label.trim().toLowerCase()).filter(Boolean)
      );
      const toAdd = labels
        .filter(l => !existing.has(l.toLowerCase()))
        .map(label => ({ label, value: '' }));
      if (!toAdd.length) {
        toast.message('All suggested labels for this category are already in the list.');
        return p;
      }
      return {
        ...p,
        specifications: [...(p.specifications ?? []), ...toAdd],
      };
    });
  };

  const saveSpecificationsOnly = async () => {
    if (!editing?.id) {
      toast.error('Save the product once with the main Save button at the bottom, then you can save specifications here.');
      return;
    }
    if (!apiAvailable) {
      toast.error('API is not connected. Start the server and try again.');
      return;
    }
    setSpecSaveBusy(true);
    try {
      const specifications = normalizeSpecsForPersist(editing.specifications);
      const saved = await updateProductApi(editing.id, { specifications });
      const nextSpecs = [...(saved.specifications ?? [])].map(s => ({
        label: s.label ?? '',
        value: s.value ?? '',
      }));
      setEditing(p =>
        p && p.id === saved.id
          ? {
              ...p,
              specifications: nextSpecs.length ? nextSpecs : [],
            }
          : p
      );
      await refreshProducts();
      window.dispatchEvent(new CustomEvent('trendnest:product-updated', { detail: { id: editing.id } }));
      toast.success(
        specifications.length > 0
          ? `Saved ${specifications.length} specification row(s). Open or refresh the product page to see them.`
          : 'Specifications cleared in the database.'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save specifications');
    } finally {
      setSpecSaveBusy(false);
    }
  };

  const save = async () => {
    if (!editing?.name || editing.price === undefined || editing.price === null) {
      toast.error('Name and price required');
      return;
    }
    setSaveBusy(true);
    try {
      const snap: Partial<Product> = {
        ...editing,
        variantOptions: editing.variantOptions?.map(v => ({
          name: v.name,
          images: [...(v.images ?? [])],
        })),
        images: [...(editing.images ?? [])],
        variants: editing.variants ? [...editing.variants] : undefined,
      };

      const sleeveTypes = snap.sleeveTypes?.filter(Boolean);

      let variantOptionsIn: ProductVariantOption[] = (snap.variantOptions ?? [])
        .map((v, i) => {
          const images = (v.images ?? []).map(s => s.trim()).filter(Boolean);
          const name = v.name.trim() || (images.length > 0 ? `Finish ${i + 1}` : '');
          return { name, images };
        })
        .filter(v => v.name.length > 0);

      const usingVariantPhotos = variantOptionsIn.length > 0;
      const rawImages = (snap.images ?? []).map(s => s.trim()).filter(Boolean);

      const variantHasData = variantOptionsIn.some(v => v.images.some(s => s.startsWith('data:')));
      const rootHasData = rawImages.some(s => s.startsWith('data:'));

      if (variantHasData || rootHasData) {
        if (!apiAvailable) {
          toast.error('Start the API and set Cloudinary in .env to save device uploads, or use https:// image URLs only.');
          return;
        }
      }

      if (variantHasData) {
        try {
          variantOptionsIn = await ensureVariantOptionsImageUrls(variantOptionsIn);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not upload variant images');
          return;
        }
      }

      let images: string[];
      if (rootHasData) {
        try {
          images = await ensureProductImageUrls(rawImages);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not upload images');
          return;
        }
      } else if (rawImages.length) {
        images = rawImages;
      } else if (usingVariantPhotos) {
        const first = variantOptionsIn.find(v => v.images.length);
        if (first) images = [...first.images];
        else if (rawImages.length) images = rawImages;
        else images = [DEFAULT_PRODUCT_IMAGE];
      } else {
        images = [DEFAULT_PRODUCT_IMAGE];
      }

      const variantsList = usingVariantPhotos
        ? variantOptionsIn.map(v => v.name)
        : (snap.variants ?? []).map(s => s.trim()).filter(Boolean);

      const persistVariantOptions = variantOptionsIn.length > 0;

      const specifications = normalizeSpecsForPersist(snap.specifications);

      if (editing.id) {
        const forcedCod = Number(snap.price);
        await updateProduct(editing.id, {
          name: snap.name,
          description: snap.description ?? '',
          price: Number(snap.price),
          onlinePrice: (snap as any).onlinePrice != null ? Number((snap as any).onlinePrice) : undefined,
          codPrice: forcedCod,
          originalPrice: snap.originalPrice,
          images,
          category: snap.category || 'fashion',
          subcategory: snap.subcategory,
          sizes: snap.sizes?.length ? snap.sizes : undefined,
          variants: variantsList.length ? variantsList : undefined,
          variantOptions: persistVariantOptions ? variantOptionsIn : [],
          sleeveTypes: sleeveTypes?.length ? sleeveTypes : undefined,
          stock: Number(snap.stock) || 0,
          rating: Number(snap.rating) || 4,
          reviews: snap.reviews || [],
          isCustomPrint: snap.isCustomPrint,
          isTrending: snap.isTrending,
          tags: snap.tags?.length ? snap.tags : undefined,
          specifications,
        });
        toast.success('Product saved to MongoDB');
      } else {
        const forcedCod = Number(snap.price);
        const newP: Product = {
          id: `p${Date.now()}`,
          name: snap.name!,
          description: snap.description || '',
          price: Number(snap.price),
          onlinePrice: (snap as any).onlinePrice != null ? Number((snap as any).onlinePrice) : undefined,
          codPrice: forcedCod,
          originalPrice: snap.originalPrice,
          images,
          category: snap.category || 'fashion',
          subcategory: snap.subcategory,
          sizes: snap.sizes?.length ? snap.sizes : undefined,
          variants: variantsList.length ? variantsList : undefined,
          variantOptions: persistVariantOptions ? variantOptionsIn : [],
          sleeveTypes: sleeveTypes?.length ? sleeveTypes : undefined,
          stock: Number(snap.stock) || 0,
          rating: Number(snap.rating) || 4,
          reviews: snap.reviews || [],
          isCustomPrint: !!snap.isCustomPrint,
          isTrending: !!snap.isTrending,
          tags: snap.tags?.length ? snap.tags : undefined,
          specifications: specifications.length ? specifications : undefined,
        };
        await addProduct(newP);
        toast.success('Product saved to MongoDB');
      }
      if (apiAvailable) {
        await refreshProducts();
      }
      setOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success('Product deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filtered = products;

  return (
    <div>
      {!loading && !apiAvailable && apiIssue && (
        <div className="mb-4 text-sm text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-3 space-y-2">
          <p className="font-medium">
            {apiIssue.code === 'NETWORK' && 'API server not reachable'}
            {apiIssue.code === 'DATABASE_UNAVAILABLE' && 'API is running — MongoDB is not connected'}
            {apiIssue.code === 'HTTP' && 'Product API request failed'}
          </p>
          <p className="text-amber-800 dark:text-amber-200/90">{apiIssue.message}</p>
          {(apiIssue.code === 'NETWORK' || apiIssue.code === 'HTTP') && (
            <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
              Local dev: the storefront talks to the API on port <strong>5050</strong>. If you only ran <code className="bg-background/80 px-1 rounded">npm run dev</code>, also run <code className="bg-background/80 px-1 rounded">npm run dev:api</code> in a second terminal, or use <code className="bg-background/80 px-1 rounded">npm run dev:full</code>. Production uses your hosted API (<code className="bg-background/80 px-1 rounded">.env.production</code> / Render).
            </p>
          )}
          <Button type="button" variant="outline" size="sm" className="border-amber-300 dark:border-amber-700" onClick={() => void refreshProducts()}>
            Retry connection
          </Button>
        </div>
      )}
      {apiAvailable && (
        <p className="mb-4 text-sm text-muted-foreground">
          Images upload to Cloudinary; products persist in MongoDB.
        </p>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-xs text-muted-foreground">
            {products.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void (async () => {
                try {
                  const d = await createProductDraftApi();
                  navigate(`/admin/products/draft/${encodeURIComponent(d.draftId)}/step/1`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Could not start wizard');
                }
              })();
            }}
          >
            Add Product (Wizard)
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => { setEditing(emptyProduct()); setVariantUrlDraft({}); }}>
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground w-full">Presets</span>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('belt')}>Belt</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('soap')}>Soap dispenser</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('printedTee')}>Printed tee</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('printedCup')}>Printed cup</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('customTee')}>Custom tee</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset('customCup')}>Custom cup</Button>
                </div>
                <Input placeholder="Product Name" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Description" value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Price (₹)" value={editing.price || ''} onChange={e => setEditing(p => ({ ...p, price: +e.target.value }))} />
                  <Input type="number" placeholder="Original Price" value={editing.originalPrice || ''} onChange={e => setEditing(p => ({ ...p, originalPrice: +e.target.value || undefined }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Online payment price (optional)"
                    value={(editing as any).onlinePrice || ''}
                    onChange={e => setEditing(p => ({ ...p, onlinePrice: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                  {/* COD price removed: regular price is used for COD */}
                </div>

                <ProductSpecificationsCard
                  specs={editing.specifications}
                  canSaveToDb={!!editing.id}
                  apiAvailable={apiAvailable}
                  specSaveBusy={specSaveBusy}
                  onAddSuggested={addSuggestedSpecFields}
                  onUpdateRow={updateSpecRow}
                  onAddRow={addSpecRow}
                  onRemoveRow={removeSpecRow}
                  onSaveToDb={() => void saveSpecificationsOnly()}
                />

                <VariantOptionsCard
                  variantOptions={editing.variantOptions as Array<{ name: string; images: string[] }> | undefined}
                  variantUrlDraft={variantUrlDraft}
                  setVariantUrlDraft={setVariantUrlDraft}
                  maxEdge={maxEdge}
                  setMaxEdge={setMaxEdge}
                  qualityPct={qualityPct}
                  setQualityPct={setQualityPct}
                  imageBusy={imageBusy}
                  variantFileRef={variantFileRef}
                  onVariantFilesChange={handleVariantImageFiles}
                  onOpenVariantUpload={openVariantUpload}
                  onUpdateVariantName={updateVariantName}
                  onRemoveVariantRow={removeVariantRow}
                  onRemoveVariantImageAt={removeVariantImageAt}
                  onAddVariantImageUrl={addVariantImageUrl}
                  onAddVariantRow={addVariantRow}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={editing.category || 'fashion'} onValueChange={v => setEditing(p => ({ ...p, category: v as Product['category'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="printed">Printed</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder={editing.variantModel?.items?.length ? 'Stock is derived from variants' : 'Stock'}
                    value={editing.stock || ''}
                    disabled={!!editing.variantModel?.items?.length}
                    onChange={e => setEditing(p => ({ ...p, stock: +e.target.value }))}
                  />
                </div>
                <Input placeholder="Subcategory" value={editing.subcategory || ''} onChange={e => setEditing(p => ({ ...p, subcategory: e.target.value }))} />
                <Input placeholder="Sizes (comma separated, e.g. waist or tee sizes)" value={editing.sizes?.join(',') || ''} onChange={e => setEditing(p => ({ ...p, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                <Input placeholder="Sleeve types (comma separated, tees only)" value={editing.sleeveTypes?.join(',') || ''} onChange={e => setEditing(p => ({ ...p, sleeveTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!editing.isCustomPrint} onChange={e => setEditing(p => ({ ...p, isCustomPrint: e.target.checked }))} />
                  Custom print flow (links to /custom-print)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!editing.isTrending} onChange={e => setEditing(p => ({ ...p, isTrending: e.target.checked }))} />
                  Trending (shown on Trending category page)
                </label>
                <Button type="button" onClick={() => void save()} className="w-full" disabled={saveBusy}>
                  {saveBusy ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Price</th>
              <th className="text-left p-3">Stock</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              return (
              <tr key={p.id} className="border-t">
                <td className="p-3 flex items-center gap-2">
                  <img src={productPrimaryImage(p)} alt="" className="w-8 h-8 rounded object-cover" />
                  <div className="min-w-0">
                    <div className="truncate max-w-[260px] font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                      {p.subcategory ? p.subcategory : optionsSummary(p)}
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{p.sku || (p.variantModel?.items?.find((x: any) => x?.isDefault)?.sku ?? '—')}</td>
                <td className="p-3 capitalize">
                  <div className="capitalize">{p.category}</div>
                  {p.subcategory ? <div className="text-[11px] text-muted-foreground">{p.subcategory}</div> : null}
                </td>
                <td className="p-3 tabular-nums">₹{p.price}</td>
                <td className="p-3">
                  <span className="tabular-nums font-medium">{p.stock}</span>
                </td>
                <td className="p-3 text-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(normalizeProductForEditing(p));
                      setVariantUrlDraft({});
                      setOpen(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}
