import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductSpecificationsCard } from '@/components/admin/ProductSpecificationsCard';
import { RichTextEditor, stripHtmlToText } from '@/components/admin/RichTextEditor';
import { uploadProductImage } from '@/lib/api';
import { processProductImageFile } from '@/lib/processProductImage';
import { ADMIN_CATEGORY_TREE, ADMIN_MAIN_CATEGORIES } from '@/data/adminCategories';
import { publishProductDraftApi } from '@/lib/adminDraftsApi';
import { ProductDraftProvider, useProductDraft } from '@/contexts/ProductDraftContext';
import { useProducts } from '@/contexts/ProductsContext';
import { Trash2 } from 'lucide-react';

type DraftVariantType = { name: string; values: string[] };
type DraftVariantItem = {
  key: string;
  attrs: Record<string, string>;
  isDefault?: boolean;
  displayName?: string;
  sku: string;
  price: number;
  originalPrice?: number;
  onlinePrice?: number;
  codPrice?: number;
  stock: number;
  previewImage?: string;
  images?: string[];
  image?: string;
  sizes?: string[];
};

function normalizeVariantTypes(raw: unknown): DraftVariantType[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => ({
      name: String((t as any)?.name ?? '').trim(),
      values: Array.isArray((t as any)?.values) ? (t as any).values.map((v: unknown) => String(v).trim()).filter(Boolean) : [],
    }))
    .filter((t) => t.name && t.values.length);
}

function normalizeVariantItems(raw: unknown): DraftVariantItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      key: String((it as any)?.key ?? '').trim(),
      attrs: (it as any)?.attrs && typeof (it as any).attrs === 'object' ? (it as any).attrs : {},
      isDefault: Boolean((it as any)?.isDefault),
      sku: String((it as any)?.sku ?? ''),
      price: Number((it as any)?.price ?? 0) || 0,
      originalPrice: (it as any)?.originalPrice != null ? Number((it as any).originalPrice) : undefined,
      onlinePrice: (it as any)?.onlinePrice != null ? Number((it as any).onlinePrice) : undefined,
      codPrice: (it as any)?.codPrice != null ? Number((it as any).codPrice) : undefined,
      stock: Number((it as any)?.stock ?? 0) || 0,
      displayName: (it as any)?.displayName != null ? String((it as any).displayName).trim() || undefined : undefined,
      previewImage: (it as any)?.previewImage ? String((it as any).previewImage).trim() : undefined,
      images: Array.isArray((it as any)?.images) ? (it as any).images.map((u: unknown) => String(u)).filter(Boolean).slice(0, 8) : undefined,
      image: (it as any)?.image ? String((it as any).image) : undefined,
      sizes: Array.isArray((it as any)?.sizes) ? (it as any).sizes.map((s: unknown) => String(s).trim()).filter(Boolean) : undefined,
    }))
    .filter((it) => it.key);
}

function buildVariantCombos(types: DraftVariantType[]): Array<{ key: string; attrs: Record<string, string> }> {
  const combos: Array<{ key: string; attrs: Record<string, string> }> = [];
  const walk = (i: number, cur: Record<string, string>) => {
    if (i >= types.length) {
      const key = types.map(t => `${t.name}:${cur[t.name] ?? ''}`).join('|');
      combos.push({ key, attrs: { ...cur } });
      return;
    }
    const t = types[i];
    for (const v of t.values) walk(i + 1, { ...cur, [t.name]: v });
  };
  walk(0, {});
  return combos;
}

function removeImageAtWithPrimary(items: string[], primaryIndex: number, removeAt: number): { items: string[]; primaryIndex: number } {
  const nextItems = items.filter((_, idx) => idx !== removeAt);
  if (nextItems.length === 0) return { items: [], primaryIndex: 0 };

  let nextPrimary = primaryIndex;
  if (removeAt === primaryIndex) nextPrimary = 0;
  else if (removeAt < primaryIndex) nextPrimary = Math.max(0, primaryIndex - 1);
  nextPrimary = Math.min(nextPrimary, Math.max(0, nextItems.length - 1));

  return { items: nextItems, primaryIndex: nextPrimary };
}

function upsertDefaultVariantItem(
  items: DraftVariantItem[],
  patch: Partial<Pick<DraftVariantItem, 'sku' | 'price' | 'originalPrice' | 'onlinePrice' | 'codPrice' | 'stock'>>
): DraftVariantItem[] {
  const key = '__default__';
  const idx = items.findIndex((x) => String((x as any)?.key) === key);
  const existing: DraftVariantItem | undefined = idx >= 0 ? items[idx] : undefined;
  const base: DraftVariantItem = existing ?? {
    key,
    attrs: {},
    isDefault: true,
    sku: '',
    price: 0,
    stock: 0,
    images: [],
  };
  const nextItem: DraftVariantItem = {
    ...base,
    ...patch,
    isDefault: true,
  };
  if (idx >= 0) {
    const next = [...items];
    next[idx] = nextItem;
    return next;
  }
  return [nextItem, ...items];
}

function mergeVariantItems(
  combos: Array<{ key: string; attrs: Record<string, string> }>,
  existing: DraftVariantItem[],
  matchKeys: string[]
): DraftVariantItem[] {
  const byKey = new Map(existing.map((it) => [String(it.key), it]));
  return combos.map((c) => {
    // Prefer exact key match when keys are stable (same attributes set).
    const exact = byKey.get(String(c.key));
    if (exact) return { ...exact, attrs: c.attrs, key: c.key };

    // When adding new attribute levels, old keys won't match. Try to reuse rows that match the previous attrs.
    const hit =
      existing.find((it) =>
        matchKeys.every((k) => String(it?.attrs?.[k] ?? '') === String(c.attrs?.[k] ?? ''))
      ) || null;

    return hit
      ? { ...hit, attrs: c.attrs, key: c.key }
        : {
          key: c.key,
          attrs: c.attrs,
          isDefault: false,
          displayName: undefined,
          sku: '',
          price: 0,
          originalPrice: undefined,
          onlinePrice: undefined,
          codPrice: undefined,
          stock: 0,
          previewImage: undefined,
          images: [],
          sizes: undefined,
        };
  });
}

function StepShell(props: {
  step: number;
  saving?: boolean;
  onGoStep?: (step: number) => void;
  children: React.ReactNode;
}) {
  const steps = [
    { n: 1, label: 'Category & Details' },
    { n: 2, label: 'Variants' },
    { n: 3, label: 'Review & Publish' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {steps.map(s => (
          <button
            key={s.n}
            type="button"
            disabled={!!props.saving}
            className={`px-2 py-1 rounded-md border transition-colors ${
              s.n === props.step
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-accent hover:text-foreground'
            } ${props.saving ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (!props.onGoStep) return;
              props.onGoStep(s.n);
            }}
          >
            Step {s.n}: {s.label}
          </button>
        ))}
      </div>
      {props.children}
    </div>
  );
}

function WizardInner({ step }: { step: number }) {
  const nav = useNavigate();
  const { draft, loading, error, updateDraftLocal, flush } = useProductDraft();
  const [saving, setSaving] = useState(false);

  const details = (draft?.details ?? {}) as Record<string, unknown>;
  const name = String(details.name ?? '');
  const description = String(details.description ?? '');
  const specs = Array.isArray(details.specifications) ? (details.specifications as Array<{ label: string; value: string }>) : [];
  const sku = String(details.sku ?? '');
  const price = details.price != null ? String(details.price) : '';
  const originalPrice = details.originalPrice != null ? String(details.originalPrice) : '';
  const onlinePrice = details.onlinePrice != null ? String(details.onlinePrice) : '';
  const codPrice = price; // Regular price == COD price (admin invariant)
  const stock = details.stock != null ? String(details.stock) : '';
  const [initialAttrPreset, setInitialAttrPreset] = useState<'Color' | 'Size' | 'Custom'>('Color');
  const [initialAttrCustom, setInitialAttrCustom] = useState('');
  const [initialAttrValues, setInitialAttrValues] = useState('Black, White');

  const go = async (nextStep: number) => {
    setSaving(true);
    try {
      await flush();
      nav(`/admin/products/draft/${encodeURIComponent(draft!.draftId)}/step/${nextStep}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading draft…</div>;
  if (error || !draft) return <div className="text-sm text-destructive">{error || 'Draft not found'}</div>;
  if (step === 4) {
    // Step 2 (Images) removed; keep old links working by redirecting to final step.
    return <Navigate to={`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/3`} replace />;
  }

  return (
    <div className="min-h-[70vh] flex flex-col">
      <div className="flex-1 space-y-4 pb-20">
        <div className="text-xs text-muted-foreground">Draft: {draft.draftId}</div>

        {step === 1 && (
          <StepShell step={1} saving={saving} onGoStep={(n) => void go(n)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Main Category</div>
                <Select
                  value={(draft.categoryMain as any) || ''}
                  onValueChange={v => updateDraftLocal({ categoryMain: v, subcategory: '' })}
                >
                  <SelectTrigger><SelectValue placeholder="Select main category (e.g., Home)" /></SelectTrigger>
                  <SelectContent>
                    {ADMIN_MAIN_CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subcategory</div>
                <Select
                  value={draft.subcategory || ''}
                  onValueChange={v => updateDraftLocal({ subcategory: v })}
                  disabled={!draft.categoryMain}
                >
                  <SelectTrigger><SelectValue placeholder={draft.categoryMain ? 'Select subcategory (e.g., Furniture)' : 'Select category first'} /></SelectTrigger>
                  <SelectContent>
                    {(ADMIN_CATEGORY_TREE as any)[draft.categoryMain] ? (
                      ((ADMIN_CATEGORY_TREE as any)[draft.categoryMain] as string[]).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="General">General</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Basic product details</p>
                  <p className="text-xs text-muted-foreground">Minimum required fields for quick product creation.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    updateDraftLocal({ variants: { ...(draft.variants as any), hasVariants: true } });
                    void go(2);
                  }}
                >
                  Add Variant →
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Product Name (e.g., Classic Black Shirt)"
                  value={name}
                  onChange={e => updateDraftLocal({ details: { ...details, name: e.target.value } })}
                />
                <Input
                  placeholder="Enter unique product SKU (e.g., SHIRT-BLACK-M)"
                  value={sku}
                  onChange={e => {
                    const nextSku = e.target.value;
                    updateDraftLocal({ details: { ...details, sku: nextSku } });
                    const items = upsertDefaultVariantItem(normalizeVariantItems((draft.variants as any)?.items), { sku: nextSku });
                    updateDraftLocal({ variants: { ...(draft.variants as any), hasVariants: true, items } });
                  }}
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Enter regular selling price"
                  value={price}
                  onChange={e => {
                    const n = e.target.value === '' ? '' : Number(e.target.value);
                    updateDraftLocal({ details: { ...details, price: n, codPrice: n } });
                    const items = upsertDefaultVariantItem(normalizeVariantItems((draft.variants as any)?.items), {
                      price: n === '' ? 0 : Number(n),
                      codPrice: n === '' ? undefined : Number(n),
                    });
                    updateDraftLocal({ variants: { ...(draft.variants as any), hasVariants: true, items } });
                  }}
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="MRP / original price (optional)"
                  value={originalPrice}
                  onChange={e =>
                    updateDraftLocal({
                      details: { ...details, originalPrice: e.target.value === '' ? '' : Number(e.target.value) },
                    })
                  }
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Enter available quantity"
                  value={stock}
                  onChange={e => {
                    const n = e.target.value === '' ? '' : Number(e.target.value);
                    updateDraftLocal({ details: { ...details, stock: n } });
                    const items = upsertDefaultVariantItem(normalizeVariantItems((draft.variants as any)?.items), { stock: n === '' ? 0 : Number(n) });
                    updateDraftLocal({ variants: { ...(draft.variants as any), hasVariants: true, items } });
                  }}
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Price for online payment (optional)"
                  value={onlinePrice}
                  onChange={e => {
                    const n = e.target.value === '' ? '' : Number(e.target.value);
                    updateDraftLocal({ details: { ...details, onlinePrice: n } });
                    const items = upsertDefaultVariantItem(normalizeVariantItems((draft.variants as any)?.items), { onlinePrice: n === '' ? undefined : Number(n) });
                    updateDraftLocal({ variants: { ...(draft.variants as any), hasVariants: true, items } });
                  }}
                />
                {/* COD price removed: regular price is used for COD */}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description (formatted)</div>
                <RichTextEditor
                  value={description}
                  onChange={(html) => updateDraftLocal({ details: { ...details, description: html } })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!details.isTrending}
                  onChange={e => updateDraftLocal({ details: { ...details, isTrending: e.target.checked } })}
                />
                Trending (shown on Trending category page)
              </label>

              <QuickPrimaryImageUpload />

              <ImagesInlineUploader />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Initial variant attribute (optional)</p>
                  <p className="text-xs text-muted-foreground">
                    Define the first variant level (e.g., Color or Size). You can add more attributes later (e.g., add Size after Color).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const attrName = initialAttrPreset === 'Custom' ? initialAttrCustom.trim() : initialAttrPreset;
                    const values = initialAttrValues.split(',').map(s => s.trim()).filter(Boolean);
                    if (!attrName || values.length < 1) {
                      toast.error('Enter an attribute name and at least one value');
                      return;
                    }
                    const types: DraftVariantType[] = [{ name: attrName, values }];
                    const combos = buildVariantCombos(types);
                    const seeded = upsertDefaultVariantItem([], {
                      sku,
                      price: price === '' ? 0 : Number(price),
                      onlinePrice: onlinePrice === '' ? undefined : Number(onlinePrice),
                      codPrice: price === '' ? undefined : Number(price),
                      stock: stock === '' ? 0 : Number(stock),
                      originalPrice: originalPrice === '' ? undefined : Number(originalPrice),
                    });
                    const items0 = mergeVariantItems(combos, seeded, [attrName]);
                    // Make the first generated variant the default and carry Step 1 values.
                    const firstKey = combos[0]?.key;
                    const items = items0.map((it) =>
                      firstKey && it.key === firstKey
                        ? {
                            ...it,
                            isDefault: true,
                            sku: sku || it.sku,
                            price: price === '' ? it.price : Number(price),
                            onlinePrice: onlinePrice === '' ? it.onlinePrice : Number(onlinePrice),
                            codPrice: price === '' ? it.codPrice : Number(price),
                            stock: stock === '' ? it.stock : Number(stock),
                            originalPrice: originalPrice === '' ? it.originalPrice : Number(originalPrice),
                          }
                        : { ...it, isDefault: false }
                    );
                    updateDraftLocal({ variants: { ...(draft.variants as any), hasVariants: true, types, items } });
                    toast.success(`Created ${items.length} variant(s)`);
                    void go(2);
                  }}
                >
                  Create variants →
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select value={initialAttrPreset} onValueChange={(v) => setInitialAttrPreset(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Attribute (e.g., Color)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Color">Color</SelectItem>
                    <SelectItem value="Size">Size</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  disabled={initialAttrPreset !== 'Custom'}
                  placeholder="Custom attribute name (e.g., Material)"
                  value={initialAttrCustom}
                  onChange={(e) => setInitialAttrCustom(e.target.value)}
                />
                <Input
                  placeholder="Values (comma separated) e.g., Black, White"
                  value={initialAttrValues}
                  onChange={(e) => setInitialAttrValues(e.target.value)}
                />
              </div>
            </div>

            <ProductSpecificationsCard
              specs={specs}
              canSaveToDb={true}
              apiAvailable={true}
              specSaveBusy={false}
              onAddSuggested={() => {
                const cur = Array.isArray(details.specifications) ? (details.specifications as any[]) : [];
                updateDraftLocal({ details: { ...details, specifications: [...cur, { label: '', value: '' }] } });
              }}
              onUpdateRow={(idx, field, value) => {
                const cur = Array.isArray(details.specifications) ? (details.specifications as any[]) : [];
                const rows = [...cur];
                while (rows.length <= idx) rows.push({ label: '', value: '' });
                rows[idx] = { ...rows[idx], [field]: value };
                updateDraftLocal({ details: { ...details, specifications: rows } });
              }}
              onAddRow={() => {
                const cur = Array.isArray(details.specifications) ? (details.specifications as any[]) : [];
                updateDraftLocal({ details: { ...details, specifications: [...cur, { label: '', value: '' }] } });
              }}
              onRemoveRow={(idx) => {
                const cur = Array.isArray(details.specifications) ? (details.specifications as any[]) : [];
                updateDraftLocal({ details: { ...details, specifications: cur.filter((_, i) => i !== idx) } });
              }}
              onSaveToDb={() => {
                toast.success('Saved to draft');
              }}
            />
          </StepShell>
        )}

        {step === 2 && (
          <VariantsStep />
        )}

        {step === 3 && (
          <ReviewPublishStep />
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex items-center justify-between gap-2 py-3">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => void go(step - 1)} disabled={saving}>
              Back
            </Button>
          ) : (
            <Link to="/admin/products">
              <Button type="button" variant="outline">Exit</Button>
            </Link>
          )}
          <div className="text-xs text-muted-foreground">
            Step {step} of 3
          </div>
          {step < 3 ? (
            <Button type="button" onClick={() => void go(step + 1)} disabled={saving}>
              Next
            </Button>
          ) : (
            <div className="w-[5.5rem]" />
          )}
        </div>
      </div>
    </div>
  );
}

function QuickPrimaryImageUpload() {
  const { draft, updateDraftLocal } = useProductDraft();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [maxEdge, setMaxEdge] = useState(1200);
  const [qualityPct, setQualityPct] = useState(85);

  const primary = draft?.images?.items?.[draft?.images?.primaryIndex ?? 0] ?? '';

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !draft) return;
    setBusy(true);
    try {
      const dataUrl = await processProductImageFile(f, { maxEdge, quality: qualityPct / 100 });
      const blob = await (await fetch(dataUrl)).blob();
      const url = await uploadProductImage(blob, `draft-${draft.draftId}-primary-${Date.now()}.jpg`);
      // Preserve other images; set the new upload as primary.
      const prevItems = Array.isArray(draft.images?.items) ? draft.images.items.map((u) => String(u)).filter(Boolean) : [];
      const prevPrimaryIndex = Number.isFinite(Number(draft.images?.primaryIndex)) ? Number(draft.images?.primaryIndex) : 0;
      const rest = prevItems
        .filter((_, i) => i !== prevPrimaryIndex)
        .map((u) => String(u))
        .filter((u) => u && u !== url);
      const nextItems = [url, ...rest].slice(0, 8);
      updateDraftLocal({ images: { items: nextItems, primaryIndex: 0 } });
      toast.success('Primary image uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload image');
    } finally {
      setBusy(false);
    }
  };

  const clearPrimary = () => {
    if (!draft) return;
    const items = Array.isArray(draft.images?.items) ? draft.images.items.map((u) => String(u)).filter(Boolean) : [];
    const idx = Number.isFinite(Number(draft.images?.primaryIndex)) ? Number(draft.images?.primaryIndex) : 0;
    if (!items.length || idx < 0 || idx >= items.length) return;
    const next = removeImageAtWithPrimary(items, idx, idx);
    updateDraftLocal({ images: next });
    toast.success('Primary image removed');
  };

  return (
    <div className="rounded-lg border border-border bg-background p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center">
          {primary ? <img src={primary} alt="" className="h-full w-full object-cover" /> : <div className="text-[10px] text-muted-foreground">No image</div>}
          {primary ? (
            <button
              type="button"
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
              onClick={clearPrimary}
              aria-label="Delete primary image"
              title="Delete image"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <div>
          <p className="text-sm font-medium">Primary image</p>
          <p className="text-xs text-muted-foreground">Upload 1 image now (you can add up to 8 in Step 3).</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : primary ? 'Replace' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

function ImagesInlineUploader() {
  const { draft, updateDraftLocal } = useProductDraft();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const images = draft?.images?.items ?? [];
  const primaryIndex = draft?.images?.primaryIndex ?? 0;

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length || !draft) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length && uploaded.length + images.length < 8; i++) {
        const dataUrl = await processProductImageFile(files[i], { maxEdge: 1200, quality: 0.85 });
        const blob = await (await fetch(dataUrl)).blob();
        const url = await uploadProductImage(blob, `draft-${draft.draftId}-${Date.now()}-${i}.jpg`);
        uploaded.push(url);
      }
      const nextItems = [...images, ...uploaded].slice(0, 8);
      updateDraftLocal({
        images: {
          items: nextItems,
          primaryIndex: Math.min(primaryIndex, Math.max(0, nextItems.length - 1)),
        },
      });
      toast.success(`Added ${uploaded.length} image(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload images');
    } finally {
      setBusy(false);
    }
  };

  const removeImageAt = (idxToRemove: number) => {
    const safeImages = images.map((u) => String(u)).filter(Boolean);
    if (idxToRemove < 0 || idxToRemove >= safeImages.length) return;
    const next = removeImageAtWithPrimary(safeImages, primaryIndex, idxToRemove);
    updateDraftLocal({ images: next });
    toast.success('Image removed');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Images (up to 8)</p>
          <p className="text-xs text-muted-foreground">Upload now to avoid switching steps. Tap an image to set it as primary.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 8}>
            {busy ? 'Uploading…' : images.length ? 'Add more' : 'Upload images'}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-sm text-muted-foreground">No images yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {images.map((src, idx) => (
            <button
              key={src + idx}
              type="button"
              className={`relative rounded-lg overflow-hidden border ${idx === primaryIndex ? 'ring-2 ring-primary' : ''}`}
              onClick={() => updateDraftLocal({ images: { items: images, primaryIndex: idx } })}
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
  );
}

function ImagesStep() {
  const nav = useNavigate();
  const { draft, updateDraftLocal, flush } = useProductDraft();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const [maxEdge, setMaxEdge] = useState(1200);
  const [qualityPct, setQualityPct] = useState(85);

  const images = draft?.images?.items ?? [];
  const primaryIndex = draft?.images?.primaryIndex ?? 0;

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length || !draft) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length && uploaded.length + images.length < 8; i++) {
        const dataUrl = await processProductImageFile(files[i], { maxEdge, quality: qualityPct / 100 });
        const blob = await (await fetch(dataUrl)).blob();
        const url = await uploadProductImage(blob, `draft-${draft.draftId}-${Date.now()}-${i}.jpg`);
        uploaded.push(url);
      }
      const nextItems = [...images, ...uploaded].slice(0, 8);
      updateDraftLocal({ images: { items: nextItems, primaryIndex: Math.min(primaryIndex, Math.max(0, nextItems.length - 1)) } });
      toast.success(`Added ${uploaded.length} image(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload images');
    } finally {
      setBusy(false);
    }
  };

  const removeImageAt = (idxToRemove: number) => {
    const safeImages = images.map((u) => String(u)).filter(Boolean);
    if (idxToRemove < 0 || idxToRemove >= safeImages.length) return;
    const next = removeImageAtWithPrimary(safeImages, primaryIndex, idxToRemove);
    updateDraftLocal({ images: next });
    toast.success('Image removed');
  };

  return (
    <StepShell
      step={1}
      saving={busy || navBusy}
      onGoStep={(n) => {
        if (!draft) return;
        setNavBusy(true);
        void (async () => {
          try {
            await flush();
            nav(`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/${n}`);
          } finally {
            setNavBusy(false);
          }
        })();
      }}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Images (up to 8)</div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
            <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 8}>
              {busy ? 'Uploading…' : 'Upload images'}
            </Button>
          </div>
        </div>
        {images.length === 0 ? (
          <div className="text-sm text-muted-foreground">No images yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {images.map((src, idx) => (
              <button
                key={src + idx}
                type="button"
                className={`relative rounded-lg overflow-hidden border ${idx === primaryIndex ? 'ring-2 ring-primary' : ''}`}
                onClick={() => updateDraftLocal({ images: { items: images, primaryIndex: idx } })}
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
    </StepShell>
  );
}

function VariantsStep() {
  const nav = useNavigate();
  const { draft, updateDraftLocal, flush } = useProductDraft();
  const variants = (draft?.variants ?? {}) as any;
  const hasVariants = !!variants.hasVariants;
  const details = (draft?.details ?? {}) as Record<string, unknown>;
  const inheritedName = String(details.name ?? '');
  const inheritedDesc = stripHtmlToText(String(details.description ?? ''));
  const [navBusy, setNavBusy] = useState(false);

  const [typeName, setTypeName] = useState('Size');
  const [typeValues, setTypeValues] = useState('S, M, L');

  const types = useMemo(() => normalizeVariantTypes(variants.types), [variants.types]);
  const items = useMemo(() => (Array.isArray(variants.items) ? (variants.items as DraftVariantItem[]) : []), [variants.items]);

  const regenerate = (prevTypes: DraftVariantType[], nextTypes: DraftVariantType[]) => {
    const combos = buildVariantCombos(nextTypes);
    const matchKeys = prevTypes.map((t) => t.name);
    const nextItems = mergeVariantItems(combos, items, matchKeys);
    updateDraftLocal({ variants: { hasVariants: true, types: nextTypes, items: nextItems } });
    toast.success(`Generated ${nextItems.length} variant(s)`);
  };

  return (
    <StepShell
      step={2}
      saving={navBusy}
      onGoStep={(n) => {
        if (!draft) return;
        setNavBusy(true);
        void (async () => {
          try {
            await flush();
            nav(`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/${n}`);
          } finally {
            setNavBusy(false);
          }
        })();
      }}
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-sm font-medium">Does this product have variants?</div>
            <Select
              value={hasVariants ? 'yes' : 'no'}
              onValueChange={v =>
                updateDraftLocal({ variants: { hasVariants: v === 'yes' } })
              }
            >
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            <strong>Inherited from main product:</strong> Name/Description. You only edit SKU, prices, stock, and image per variant.
          </div>
          <div className="text-xs text-muted-foreground">
            <div><strong>Name:</strong> {inheritedName || '—'}</div>
            <div><strong>Description:</strong> {inheritedDesc ? `${inheritedDesc.slice(0, 80)}${inheritedDesc.length > 80 ? '…' : ''}` : '—'}</div>
          </div>
        </div>

        {!hasVariants ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Enter unique product SKU (e.g., SHIRT-BLACK-M)"
              value={String(variants.simple?.sku ?? '')}
              onChange={e =>
                updateDraftLocal({
                  variants: {
                    simple: { ...(variants.simple ?? {}), sku: e.target.value },
                  },
                })
              }
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Enter regular selling price"
              value={String(variants.simple?.price ?? '')}
              onChange={e =>
                updateDraftLocal({
                  variants: {
                    simple: { ...(variants.simple ?? {}), price: Number(e.target.value), codPrice: Number(e.target.value) },
                  },
                })
              }
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Price for online payment (optional)"
              value={String(variants.simple?.onlinePrice ?? '')}
              onChange={e =>
                updateDraftLocal({
                  variants: {
                    simple: {
                      ...(variants.simple ?? {}),
                      onlinePrice: e.target.value ? Number(e.target.value) : undefined,
                    },
                  },
                })
              }
            />
            {/* COD price removed: regular price is used for COD */}
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Enter available quantity"
              value={String(variants.simple?.stock ?? '')}
              onChange={e =>
                updateDraftLocal({
                  variants: {
                    simple: { ...(variants.simple ?? {}), stock: Number(e.target.value) },
                  },
                })
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 space-y-2">
              <div className="text-sm font-medium">Variant types</div>
              {types.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Current: {types.map(t => `${t.name} (${t.values.length})`).join(' • ')}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Add attribute (e.g. Size)" value={typeName} onChange={e => setTypeName(e.target.value)} />
                <Input placeholder="Values (comma separated) e.g., S, M, L" value={typeValues} onChange={e => setTypeValues(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const name = typeName.trim();
                    const values = typeValues.split(',').map(s => s.trim()).filter(Boolean);
                    if (!name || values.length < 1) {
                      toast.error('Enter an attribute name and at least one value');
                      return;
                    }
                    const existingIdx = types.findIndex((t) => t.name.toLowerCase() === name.toLowerCase());
                    let nextTypes: DraftVariantType[];
                    if (existingIdx >= 0) {
                      // Add new values to existing attribute (does not replace Step 1 values).
                      const cur = types[existingIdx];
                      const mergedValues = Array.from(new Set([...cur.values, ...values]));
                      nextTypes = types.map((t, i) => (i === existingIdx ? { ...t, values: mergedValues } : t));
                    } else {
                      // Add another attribute level (Color -> Size etc.)
                      nextTypes = [...types, { name, values }];
                    }
                    regenerate(types, nextTypes);
                  }}
                >
                  Add attribute & generate
                </Button>
                <Button type="button" variant="outline" onClick={() => regenerate(types, types)}>
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateDraftLocal({ variants: { hasVariants: true, types: [], items: [] } })
                  }
                >
                  Clear
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No combinations generated yet.</div>
            ) : (
              <div className="space-y-2">
                {items.slice(0, 120).map((it: any, idx: number) => (
                  <VariantRow
                    key={String(it.key) + idx}
                    draftId={draft?.draftId || ''}
                    idx={idx}
                    item={it}
                    items={items}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < items.length - 1}
                    onMoveRow={(from, to) => {
                      if (from < 0 || to < 0 || from === to || to >= items.length) return;
                      const next = [...items];
                      const hit = next[from];
                      next[from] = next[to];
                      next[to] = hit;
                      updateDraftLocal({ variants: { items: next } });
                    }}
                    onChangeItems={(next) =>
                      updateDraftLocal({ variants: { items: next } })
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const next = [
                      ...items,
                      {
                        key: `custom-${Date.now()}`,
                        attrs: {},
                        displayName: undefined,
                        sku: '',
                        price: 0,
                        onlinePrice: undefined,
                        codPrice: undefined,
                        stock: 0,
                        previewImage: undefined,
                        image: undefined,
                        images: [],
                        sizes: undefined,
                      },
                    ];
                    updateDraftLocal({ variants: { items: next } });
                  }}
                >
                  Add Another Variant
                </Button>
                {items.length > 120 && (
                  <div className="text-xs text-muted-foreground">Showing first 120 variants. (Scalable pagination can be added later.)</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </StepShell>
  );
}

function VariantRow(props: {
  draftId: string;
  idx: number;
  item: any;
  items: any[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveRow: (from: number, to: number) => void;
  onChangeItems: (next: any[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const previewFileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const uploadImages = async (files: File[]) => {
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await processProductImageFile(files[i], { maxEdge: 1200, quality: 0.85 });
        const blob = await (await fetch(dataUrl)).blob();
        const url = await uploadProductImage(blob, `draft-${props.draftId}-variant-${Date.now()}-${props.idx}-${i}.jpg`);
        uploaded.push(url);
      }
      const next = [...props.items];
      const prevImages = Array.isArray((props.item as any).images) ? (props.item as any).images : [];
      next[props.idx] = { ...props.item, images: [...prevImages, ...uploaded].slice(0, 8) };
      props.onChangeItems(next);
      toast.success(`Added ${uploaded.length} image(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload variant images');
    } finally {
      setBusy(false);
    }
  };

  const images = (Array.isArray((props.item as any).images) ? (props.item as any).images : [])
    .map((u: unknown) => String(u))
    .filter(Boolean);
  const previewImage = String((props.item as any).previewImage ?? '').trim();

  const uploadPreviewImage = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await processProductImageFile(file, { maxEdge: 900, quality: 0.9 });
      const blob = await (await fetch(dataUrl)).blob();
      const url = await uploadProductImage(blob, `draft-${props.draftId}-variant-preview-${Date.now()}-${props.idx}.jpg`);
      const next = [...props.items];
      next[props.idx] = { ...props.item, previewImage: url };
      props.onChangeItems(next);
      toast.success('Variant preview image uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload preview image');
    } finally {
      setBusy(false);
    }
  };

  const removeVariantImageAt = (idxToRemove: number) => {
    if (idxToRemove < 0 || idxToRemove >= images.length) return;
    const next = [...props.items];
    next[props.idx] = { ...props.item, images: images.filter((_, i) => i !== idxToRemove) };
    props.onChangeItems(next);
    toast.success('Variant image removed');
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {Object.keys(props.item.attrs ?? {}).length ? (
            Object.entries(props.item.attrs ?? {}).map(([k, v]) => (
              <div key={k}><strong>{k}:</strong> {String(v)}</div>
            ))
          ) : (
            <div>Custom variant</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!props.canMoveUp}
            onClick={() => props.onMoveRow(props.idx, props.idx - 1)}
          >
            Move up
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!props.canMoveDown}
            onClick={() => props.onMoveRow(props.idx, props.idx + 1)}
          >
            Move down
          </Button>
          <input
            ref={previewFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              if (file) void uploadPreviewImage(file);
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = '';
              if (files.length) void uploadImages(files);
            }}
          />
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => previewFileRef.current?.click()}>
            {busy ? 'Uploading…' : previewImage ? 'Replace preview' : 'Upload preview'}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Uploading…' : images.length ? 'Add/Replace images' : 'Upload images'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-2 py-2">
        <div className="h-14 w-14 overflow-hidden rounded-md border bg-background">
          {previewImage ? (
            <img src={previewImage} alt="Variant preview" className="h-full w-full object-cover" />
          ) : images[0] ? (
            <img src={images[0]} alt="Variant preview fallback" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">No preview</div>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Selector thumbnail: uses preview image first, otherwise first gallery image.
        </div>
        {previewImage ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              const next = [...props.items];
              next[props.idx] = { ...props.item, previewImage: undefined };
              props.onChangeItems(next);
            }}
          >
            Clear preview
          </Button>
        ) : null}
      </div>

      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {images.map((src: string, i: number) => (
              <button
                key={src + i}
                type="button"
                className="relative"
                onClick={() => {
                  // Move clicked image to front (primary)
                  const next = [...props.items];
                  const rest = images.filter((_, j) => j !== i);
                  next[props.idx] = { ...props.item, images: [src, ...rest] };
                  props.onChangeItems(next);
                }}
                title={i === 0 ? 'Primary image' : 'Set as primary'}
              >
                <img src={src} alt="" className={`h-14 w-14 object-cover rounded-md border ${i === 0 ? 'ring-2 ring-primary' : ''}`} />
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeVariantImageAt(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      removeVariantImageAt(i);
                    }
                  }}
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white transition hover:bg-black/80"
                  aria-label="Delete variant image"
                  title="Delete image"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            First image is used as the primary image when customer selects this variant.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <Input
          className="sm:col-span-4"
          placeholder="Display name (optional, e.g. Black / Grey)"
          value={String((props.item as any).displayName ?? '')}
          onChange={e => {
            const next = [...props.items];
            next[props.idx] = { ...props.item, displayName: e.target.value };
            props.onChangeItems(next);
          }}
        />
        <Input
          className="sm:col-span-4"
          placeholder="Enter unique product SKU (e.g., SHIRT-BLACK-M)"
          value={String(props.item.sku ?? '')}
          onChange={e => {
            const next = [...props.items];
            next[props.idx] = { ...props.item, sku: e.target.value };
            props.onChangeItems(next);
          }}
        />
        <Input
          className="sm:col-span-4"
          placeholder="Variant sizes (optional, comma separated)"
          value={Array.isArray((props.item as any).sizes) ? (props.item as any).sizes.join(', ') : ''}
          onChange={e => {
            const sizes = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const next = [...props.items];
            next[props.idx] = { ...props.item, sizes: sizes.length ? sizes : undefined };
            props.onChangeItems(next);
          }}
        />
        <Input
          className="sm:col-span-2"
          type="number"
          inputMode="decimal"
          placeholder="Enter regular selling price"
          value={String(props.item.price ?? '')}
          onChange={e => {
            const next = [...props.items];
            const n = Number(e.target.value);
            next[props.idx] = { ...props.item, price: n, codPrice: n };
            props.onChangeItems(next);
          }}
        />
        <Input
          className="sm:col-span-2"
          type="number"
          inputMode="decimal"
          placeholder="MRP / original price (optional)"
          value={String((props.item as any).originalPrice ?? '')}
          onChange={e => {
            const next = [...props.items];
            next[props.idx] = { ...props.item, originalPrice: e.target.value ? Number(e.target.value) : undefined };
            props.onChangeItems(next);
          }}
        />
        <Input
          className="sm:col-span-2"
          type="number"
          inputMode="decimal"
          placeholder="Price for online payment (optional)"
          value={String(props.item.onlinePrice ?? '')}
          onChange={e => {
            const next = [...props.items];
            next[props.idx] = { ...props.item, onlinePrice: e.target.value ? Number(e.target.value) : undefined };
            props.onChangeItems(next);
          }}
        />
        {/* COD price removed: regular price is used for COD */}
        <Input
          className="sm:col-span-2"
          type="number"
          inputMode="numeric"
          placeholder="Enter available quantity"
          value={String(props.item.stock ?? '')}
          onChange={e => {
            const next = [...props.items];
            next[props.idx] = { ...props.item, stock: Number(e.target.value) };
            props.onChangeItems(next);
          }}
        />
      </div>
    </div>
  );
}

function ReviewPublishStep() {
  const { draft, updateDraftLocal, flush } = useProductDraft();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const { refreshProducts } = useProducts();

  if (!draft) return null;
  const details = (draft.details ?? {}) as any;
  const variants = (draft.variants ?? {}) as any;
  const shipping = (draft.shipping ?? {}) as any;

  const shipStr = (v: any) => (v === undefined || v === null ? '' : String(v));
  const shipNum = (s: string) => {
    if (s.trim() === '') return '';
    const n = Number(s);
    return Number.isFinite(n) ? n : s; // keep raw so admin sees what they typed
  };
  const isBadPositive = (v: any) => v !== '' && (!Number.isFinite(Number(v)) || Number(v) <= 0);

  const publish = async (publishAs: 'draft' | 'published') => {
    setBusy(true);
    try {
      await flush();
      const { product } = await publishProductDraftApi(draft.draftId, publishAs);
      // Ensure storefront/admin product lists update immediately after publishing.
      await refreshProducts();
      toast.success(publishAs === 'published' ? 'Published' : 'Saved as draft');
      // Let any open PDP refresh if it is currently viewing this product.
      const id = (product as { id?: string } | null)?.id;
      if (id) window.dispatchEvent(new CustomEvent('trendnest:product-updated', { detail: { id } }));
      nav('/admin/products');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell
      step={3}
      saving={busy}
      onGoStep={(n) => {
        if (!draft) return;
        setBusy(true);
        void (async () => {
          try {
            await flush();
            nav(`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/${n}`);
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Category</div>
            <Link to={`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/1`} className="text-primary text-xs hover:underline">
              Edit
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            <div><strong>Main:</strong> {draft.categoryMain || '—'}</div>
            <div><strong>Sub:</strong> {draft.subcategory || '—'}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Product details</div>
            <Link to={`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/1`} className="text-primary text-xs hover:underline">
              Edit
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            <div><strong>Name:</strong> {String(details.name ?? '—')}</div>
            <div><strong>SKU:</strong> {String(details.sku ?? '—')}</div>
            <div><strong>Price:</strong> {details.price != null ? `₹${details.price}` : '—'}</div>
            <div><strong>Stock:</strong> {details.stock != null ? String(details.stock) : '—'}</div>
            <div><strong>Online price:</strong> {details.onlinePrice != null ? `₹${details.onlinePrice}` : '—'}</div>
            <div><strong>COD price:</strong> {details.price != null ? `₹${details.price}` : '—'}</div>
            <div><strong>Trending:</strong> {details.isTrending ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Images</div>
            <Link to={`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/1`} className="text-primary text-xs hover:underline">
              Edit
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            {draft.images?.items?.length ? `${draft.images.items.length} image(s) (primary: #${(draft.images.primaryIndex ?? 0) + 1})` : 'No images'}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Variants</div>
            <Link to={`/admin/products/draft/${encodeURIComponent(draft.draftId)}/step/2`} className="text-primary text-xs hover:underline">
              Edit
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            {variants.hasVariants ? `${Array.isArray(variants.items) ? variants.items.length : 0} variant(s)` : 'No variants (simple product)'}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Shipping (internal)</div>
            <div className="text-xs text-muted-foreground">Used for Shiprocket only</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Weight (kg)</div>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={shipStr(shipping.weightKg)}
                onChange={(e) => updateDraftLocal({ shipping: { ...shipping, weightKg: shipNum(e.target.value) } })}
              />
              {isBadPositive(shipping.weightKg) ? <div className="text-[11px] text-destructive">Must be a positive number</div> : null}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Length (cm)</div>
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min={0}
                value={shipStr(shipping.lengthCm)}
                onChange={(e) => updateDraftLocal({ shipping: { ...shipping, lengthCm: shipNum(e.target.value) } })}
              />
              {isBadPositive(shipping.lengthCm) ? <div className="text-[11px] text-destructive">Must be a positive number</div> : null}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Width (cm)</div>
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min={0}
                value={shipStr(shipping.widthCm)}
                onChange={(e) => updateDraftLocal({ shipping: { ...shipping, widthCm: shipNum(e.target.value) } })}
              />
              {isBadPositive(shipping.widthCm) ? <div className="text-[11px] text-destructive">Must be a positive number</div> : null}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Height (cm)</div>
              <Input
                type="number"
                inputMode="decimal"
                step="1"
                min={0}
                value={shipStr(shipping.heightCm)}
                onChange={(e) => updateDraftLocal({ shipping: { ...shipping, heightCm: shipNum(e.target.value) } })}
              />
              {isBadPositive(shipping.heightCm) ? <div className="text-[11px] text-destructive">Must be a positive number</div> : null}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Optional. If blank, your existing Shiprocket defaults will be used.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void publish('draft')}>
          {busy ? 'Saving…' : 'Save as Draft'}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void publish('published')}>
          {busy ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </StepShell>
  );
}

export default function AdminProductWizardPage() {
  const { draftId, step } = useParams<{ draftId: string; step: string }>();
  const s = Number(step || '1');
  const stepNum = Number.isFinite(s) ? Math.max(1, Math.min(4, Math.floor(s))) : 1;

  if (!draftId) return <Navigate to="/admin/products" replace />;
  return (
    <ProductDraftProvider draftId={draftId}>
      <WizardInner step={stepNum} />
    </ProductDraftProvider>
  );
}

