import { useState, useRef } from 'react';
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
import {
  uploadProductImage,
  ensureProductImageUrls,
  ensureVariantOptionsImageUrls,
  DEFAULT_PRODUCT_IMAGE,
} from '@/lib/api';
import { productPrimaryImage } from '@/lib/productImages';

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
  isCustomPrint: false,
  isTrending: false,
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
  if (p.variantOptions?.length) {
    return {
      ...p,
      variantOptions: p.variantOptions.map(v => ({
        name: v.name,
        images: [...(v.images ?? [])],
      })),
    };
  }
  if (p.variants?.length) {
    return {
      ...p,
      variantOptions: p.variants.map((name, i) => ({
        name,
        images: i === 0 ? [...(p.images ?? [])] : [],
      })),
    };
  }
  return { ...p };
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

export default function AdminProducts() {
  const { products, addProduct, updateProduct, deleteProduct, apiAvailable, apiIssue, loading, refreshProducts } = useProducts();
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [maxEdge, setMaxEdge] = useState(1000);
  const [qualityPct, setQualityPct] = useState(85);
  const [imageBusy, setImageBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const variantFileRef = useRef<HTMLInputElement>(null);
  const variantUploadIdxRef = useRef<number | null>(null);
  const [variantUrlDraft, setVariantUrlDraft] = useState<Record<number, string>>({});

  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length || !editing) return;
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
          const url = await uploadProductImage(blob, `product-${Date.now()}-${i}.jpg`);
          appended.push(url);
        } catch {
          appended.push(dataUrl);
          anyDeferred = true;
        }
      }
      setEditing(p =>
        p
          ? {
              ...p,
              images: [...(p.images ?? []).map(s => s.trim()).filter(Boolean), ...appended],
            }
          : p
      );
      if (anyDeferred) {
        toast.message(
          `${appended.length} image(s) prepared locally. Start the API and Cloudinary, or click Save to upload data URLs when online.`,
          { duration: 6000 }
        );
      } else {
        toast.success(`Uploaded ${appended.length} image(s) to Cloudinary.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process images');
    } finally {
      setImageBusy(false);
    }
  };

  const removeImageAt = (idx: number) => {
    setEditing(p => {
      if (!p?.images) return p;
      const next = p.images.filter((_, i) => i !== idx);
      return { ...p, images: next };
    });
  };

  const addImageUrl = () => {
    const u = imageUrlDraft.trim();
    if (!u || !editing) return;
    setEditing(p =>
      p ? { ...p, images: [...(p.images ?? []).map(s => s.trim()).filter(Boolean), u] } : p
    );
    setImageUrlDraft('');
    toast.success('Image URL added to gallery');
  };

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
        if (!p?.variantOptions) return p;
        const opts = p.variantOptions.map((o, i) =>
          i === vidx
            ? {
                ...o,
                images: [...(o.images ?? []).map(s => s.trim()).filter(Boolean), ...appended],
              }
            : o
        );
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
      if (!p?.variantOptions) return p;
      const opts = p.variantOptions.map((o, i) =>
        i === vidx ? { ...o, images: (o.images ?? []).filter((_, j) => j !== imgIdx) } : o
      );
      return { ...p, variantOptions: opts };
    });
  };

  const updateVariantName = (vidx: number, name: string) => {
    setEditing(p => {
      if (!p?.variantOptions) return p;
      const opts = p.variantOptions.map((o, i) => (i === vidx ? { ...o, name } : o));
      return { ...p, variantOptions: opts };
    });
  };

  const addVariantRow = () => {
    setEditing(p =>
      p
        ? {
            ...p,
            variantOptions: [...(p.variantOptions ?? []), { name: '', images: [] as string[] }],
          }
        : p
    );
  };

  const removeVariantRow = (vidx: number) => {
    setEditing(p => {
      if (!p?.variantOptions) return p;
      const opts = p.variantOptions.filter((_, i) => i !== vidx);
      return { ...p, variantOptions: opts.length ? opts : undefined };
    });
    setVariantUrlDraft(d => {
      const next = { ...d };
      delete next[vidx];
      return next;
    });
  };

  const addVariantImageUrl = (vidx: number) => {
    const u = (variantUrlDraft[vidx] ?? '').trim();
    if (!u || !editing?.variantOptions) return;
    setEditing(p => {
      if (!p?.variantOptions) return p;
      const opts = p.variantOptions.map((o, i) =>
        i === vidx
          ? { ...o, images: [...(o.images ?? []).map(s => s.trim()).filter(Boolean), u] }
          : o
      );
      return { ...p, variantOptions: opts };
    });
    setVariantUrlDraft(d => ({ ...d, [vidx]: '' }));
    toast.success('Image URL added for this variant');
  };

  const promoteToPerVariantImages = () => {
    if (!editing) return;
    const names = (editing.variants ?? []).map(s => s.trim()).filter(Boolean);
    if (!names.length) {
      toast.error('Enter color/finish names (comma separated) first.');
      return;
    }
    setEditing(p =>
      p
        ? {
            ...p,
            variantOptions: names.map((name, i) => ({
              name,
              images: i === 0 ? [...(p.images ?? []).map(s => s.trim()).filter(Boolean)] : [],
            })),
          }
        : p
    );
    toast.success('Per-variant mode: add images for each color below.');
  };

  const clearVariantOptionsMode = () => {
    setEditing(p => {
      if (!p) return p;
      const names = (p.variantOptions ?? []).map(v => v.name.trim()).filter(Boolean);
      const merged = [...new Set((p.variantOptions ?? []).flatMap(v => (v.images ?? []).map(s => s.trim()).filter(Boolean)))];
      return {
        ...p,
        variantOptions: undefined,
        variants: names.length ? names : p.variants,
        images: merged.length ? merged : p.images,
      };
    });
  };

  const applyPreset = (key: keyof typeof PRESETS) => {
    setEditing(prev => ({ ...emptyProduct(), ...prev, ...PRESETS[key] }));
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
        .map(v => ({
          name: v.name.trim(),
          images: (v.images ?? []).map(s => s.trim()).filter(Boolean),
        }))
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

      const persistVariantOptions =
        usingVariantPhotos || Boolean(snap.variantOptions && snap.variantOptions.length > 0);

      if (editing.id) {
        await updateProduct(editing.id, {
          name: snap.name,
          description: snap.description ?? '',
          price: Number(snap.price),
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
        });
        toast.success('Product saved to MongoDB');
      } else {
        const newP: Product = {
          id: `p${Date.now()}`,
          name: snap.name!,
          description: snap.description || '',
          price: Number(snap.price),
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

  return (
    <div>
      {!loading && !apiAvailable && apiIssue && (
        <div className="mb-4 text-sm text-amber-900 dark:text-amber-100 bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-3 space-y-2">
          <p className="font-medium">
            {apiIssue.code === 'NETWORK' && 'API server not reachable'}
            {apiIssue.code === 'DATABASE_UNAVAILABLE' && 'API is running — MongoDB is not connected'}
            {apiIssue.code === 'HTTP' && 'Product API error'}
          </p>
          <p className="text-amber-800 dark:text-amber-200/90">{apiIssue.message}</p>
          {apiIssue.code === 'NETWORK' && (
            <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
              Tip: use <code className="bg-background/80 px-1 rounded">npm run dev:full</code> so Vite and the API start together (API on port 5050).
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
        <h1 className="text-2xl font-bold">Products</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => { setEditing(emptyProduct()); setImageUrlDraft(''); setVariantUrlDraft({}); }}>
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

                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <p className="text-sm font-medium">Images</p>
                  <input
                    ref={variantFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleVariantImageFiles}
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageFiles}
                  />
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label htmlFor="img-max-edge">Max edge (px)</Label>
                      <span className="text-muted-foreground tabular-nums">{maxEdge}px</span>
                    </div>
                    <Slider
                      id="img-max-edge"
                      min={400}
                      max={1920}
                      step={20}
                      value={[maxEdge]}
                      onValueChange={v => setMaxEdge(v[0])}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-xs">
                      <Label htmlFor="img-quality">JPEG quality</Label>
                      <span className="text-muted-foreground tabular-nums">{qualityPct}%</span>
                    </div>
                    <Slider
                      id="img-quality"
                      min={50}
                      max={100}
                      step={5}
                      value={[qualityPct]}
                      onValueChange={v => setQualityPct(v[0])}
                    />
                  </div>

                  {editing.variantOptions && editing.variantOptions.length > 0 ? (
                    <div className="space-y-4 pt-1">
                      <p className="text-xs text-muted-foreground">
                        Each color/finish has its own gallery. The storefront switches photos when the customer picks a variant.
                      </p>
                      {editing.variantOptions.map((opt, vidx) => (
                        <div key={vidx} className="rounded-md border bg-background/80 p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="h-9 max-w-[200px]"
                              placeholder="Variant name (e.g. Black)"
                              value={opt.name}
                              onChange={e => updateVariantName(vidx, e.target.value)}
                            />
                            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => openVariantUpload(vidx)} disabled={imageBusy}>
                              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-9 text-destructive" onClick={() => removeVariantRow(vidx)}>
                              Remove variant
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!(opt.images ?? []).filter(Boolean).length ? (
                              <div className="flex h-16 w-16 items-center justify-center rounded border border-dashed">
                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                              </div>
                            ) : (
                              (opt.images ?? [])
                                .map((src, idx) => ({ src, idx }))
                                .filter(x => x.src.trim())
                                .map(({ src, idx }) => (
                                  <div key={`${vidx}-${idx}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded border">
                                    <img src={src} alt="" className="h-full w-full object-cover" />
                                    <button
                                      type="button"
                                      aria-label="Remove"
                                      className="absolute right-0.5 top-0.5 rounded bg-background/90 p-0.5 shadow"
                                      onClick={() => removeVariantImageAt(vidx, idx)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))
                            )}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <Input
                              className="h-8 text-xs"
                              placeholder="https://…"
                              value={variantUrlDraft[vidx] ?? ''}
                              onChange={e => setVariantUrlDraft(d => ({ ...d, [vidx]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addVariantImageUrl(vidx);
                                }
                              }}
                            />
                            <Button type="button" variant="secondary" size="sm" className="h-8 shrink-0" onClick={() => addVariantImageUrl(vidx)}>
                              Add URL
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={addVariantRow}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add variant
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={clearVariantOptionsMode}>
                          Use one shared gallery for all colors
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        One image set for every variant. To use different photos per color, enter names below then click &quot;Per-variant photos&quot;.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(editing.images?.length ? editing.images.filter(Boolean) : []).length === 0 ? (
                          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed bg-background">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        ) : (
                          editing.images
                            ?.map((src, idx) => ({ src, idx }))
                            .filter(x => x.src.trim())
                            .map(({ src, idx }) => (
                              <div key={`${src.slice(0, 48)}-${idx}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-background">
                                <img src={src} alt="" className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  aria-label="Remove image"
                                  className="absolute right-0.5 top-0.5 rounded bg-background/90 p-1 shadow hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => removeImageAt(idx)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        disabled={imageBusy}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        {imageBusy ? 'Processing…' : 'Upload images'}
                      </Button>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <Label htmlFor="img-url-add" className="text-xs text-muted-foreground">
                            Add image URL
                          </Label>
                          <Input
                            id="img-url-add"
                            className="mt-1 h-9"
                            placeholder="https://…"
                            value={imageUrlDraft}
                            onChange={e => setImageUrlDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addImageUrl();
                              }
                            }}
                          />
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={addImageUrl}>
                          Add URL
                        </Button>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={promoteToPerVariantImages}>
                        Per-variant photos (uses comma names below)
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={editing.category || 'fashion'} onValueChange={v => setEditing(p => ({ ...p, category: v as Product['category'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="printed">Printed</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Stock" value={editing.stock || ''} onChange={e => setEditing(p => ({ ...p, stock: +e.target.value }))} />
                </div>
                <Input placeholder="Subcategory" value={editing.subcategory || ''} onChange={e => setEditing(p => ({ ...p, subcategory: e.target.value }))} />
                <Input placeholder="Sizes (comma separated, e.g. waist or tee sizes)" value={editing.sizes?.join(',') || ''} onChange={e => setEditing(p => ({ ...p, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                {!(editing.variantOptions && editing.variantOptions.length > 0) && (
                  <Input
                    placeholder="Colors / finishes (comma separated) — then use “Per-variant photos” for separate galleries"
                    value={editing.variants?.join(',') || ''}
                    onChange={e =>
                      setEditing(p => ({ ...p, variants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))
                    }
                  />
                )}
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
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Options</th>
              <th className="text-left p-3">Price</th>
              <th className="text-left p-3">Stock</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3 flex items-center gap-2">
                  <img src={productPrimaryImage(p)} alt="" className="w-8 h-8 rounded object-cover" />
                  <span className="truncate max-w-[150px]">{p.name}</span>
                </td>
                <td className="p-3 capitalize">{p.category}</td>
                <td className="p-3 text-xs text-muted-foreground max-w-[180px]">{optionsSummary(p)}</td>
                <td className="p-3">₹{p.price}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3 text-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setEditing(normalizeProductForEditing(p));
                      setImageUrlDraft('');
                      setVariantUrlDraft({});
                      setOpen(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
