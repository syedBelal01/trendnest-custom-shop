import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Edit, Eye, EyeOff, Plus, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { uploadProductImage } from '@/lib/api';
import {
  createHeroBannerApi,
  deleteHeroBannerApi,
  fetchAdminHeroBannersWithSettingsApi,
  updateHeroBannerSettingsApi,
  updateHeroBannerApi,
  type SaleBannerMutationInput,
} from '@/lib/heroBannersApi';
import type { HeroFirstSlideMode, SaleBanner, SaleBannerStatus, SaleBannerTheme } from '@/types';

type BannerFormState = {
  title: string;
  subtitle: string;
  desktopImage: string;
  mobileImage: string;
  ctaText: string;
  ctaLink: string;
  theme: SaleBannerTheme;
  startDate: string; // datetime-local
  endDate: string; // datetime-local
  status: SaleBannerStatus;
  priority: string;
  targetCategory: string;
  targetProductIds: string;
};

const THEMES: SaleBannerTheme[] = ['default', 'winter', 'summer', 'eid', 'holi', 'diwali', 'flash'];
const STATUSES: SaleBannerStatus[] = ['draft', 'live', 'disabled'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalInputValue(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function localInputToIso(v: string): string {
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function defaultForm(): BannerFormState {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: '',
    subtitle: '',
    desktopImage: '',
    mobileImage: '',
    ctaText: 'Shop Now',
    ctaLink: '/category/trending',
    theme: 'default',
    startDate: toLocalInputValue(now.toISOString()),
    endDate: toLocalInputValue(end.toISOString()),
    status: 'draft',
    priority: '100',
    targetCategory: '',
    targetProductIds: '',
  };
}

function lifecycleStatus(b: SaleBanner): { label: 'Live' | 'Scheduled' | 'Expired' | 'Draft' | 'Disabled'; className: string } {
  if (b.status === 'draft') return { label: 'Draft', className: 'bg-slate-500/10 text-slate-700 border-slate-300' };
  if (b.status === 'disabled') return { label: 'Disabled', className: 'bg-red-500/10 text-red-700 border-red-200' };
  const now = Date.now();
  const startMs = new Date(b.startDate).getTime();
  const endMs = new Date(b.endDate).getTime();
  if (Number.isFinite(startMs) && now < startMs) {
    return { label: 'Scheduled', className: 'bg-indigo-500/10 text-indigo-700 border-indigo-200' };
  }
  if (Number.isFinite(endMs) && now > endMs) {
    return { label: 'Expired', className: 'bg-amber-500/10 text-amber-700 border-amber-200' };
  }
  return { label: 'Live', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' };
}

function buildPayloadFromForm(form: BannerFormState): SaleBannerMutationInput {
  const title = form.title.trim();
  const desktopImage = form.desktopImage.trim();
  if (!title) throw new Error('Sale title is required');
  if (!desktopImage) throw new Error('Desktop banner image is required');

  const startDate = localInputToIso(form.startDate);
  const endDate = localInputToIso(form.endDate);
  if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
    throw new Error('End date must be after start date');
  }

  const priority = Math.floor(Number(form.priority));
  const targetProductIds = form.targetProductIds
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    title,
    subtitle: form.subtitle.trim(),
    desktopImage,
    mobileImage: form.mobileImage.trim(),
    ctaText: form.ctaText.trim(),
    ctaLink: form.ctaLink.trim(),
    theme: form.theme,
    startDate,
    endDate,
    status: form.status,
    priority: Number.isFinite(priority) ? priority : 100,
    targetCategory: form.targetCategory.trim(),
    targetProductIds,
  };
}

function sortByPriority(rows: SaleBanner[]): SaleBanner[] {
  return [...rows].sort((a, b) => {
    const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 100;
    const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 100;
    if (pa !== pb) return pa - pb;
    return String(a.id).localeCompare(String(b.id));
  });
}

export default function AdminHeroSaleBanners() {
  const [rows, setRows] = useState<SaleBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFirstSlide, setSavingFirstSlide] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [firstSlideMode, setFirstSlideMode] = useState<HeroFirstSlideMode>('auto');
  const [firstBannerId, setFirstBannerId] = useState('');
  const [form, setForm] = useState<BannerFormState>(defaultForm);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const desktopFileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const loaded = await fetchAdminHeroBannersWithSettingsApi();
      setRows(sortByPriority(loaded.banners));
      const settings = loaded.settings;
      setFirstSlideMode(settings.firstSlideMode);
      setFirstBannerId(settings.firstBannerId || '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const sortedRows = useMemo(() => sortByPriority(rows), [rows]);
  const firstSlideBannerOptions = useMemo(
    () =>
      sortedRows.map((b) => {
        const life = lifecycleStatus(b).label;
        return { id: b.id, label: `${b.title} (${life})` };
      }),
    [sortedRows]
  );

  const saveFirstSlidePreference = async () => {
    if (firstSlideMode === 'banner' && !firstBannerId.trim()) {
      toast.error('Select a sale banner for first slide');
      return;
    }
    try {
      setSavingFirstSlide(true);
      const next = await updateHeroBannerSettingsApi({
        firstSlideMode,
        firstBannerId: firstSlideMode === 'banner' ? firstBannerId.trim() : '',
      });
      setFirstSlideMode(next.firstSlideMode);
      setFirstBannerId(next.firstBannerId || '');
      toast.success('First slide preference updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save first slide preference');
    } finally {
      setSavingFirstSlide(false);
    }
  };

  const startNew = () => {
    setEditId(null);
    setForm(defaultForm());
  };

  const beginEdit = (banner: SaleBanner) => {
    setEditId(banner.id);
    setForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      desktopImage: banner.desktopImage || '',
      mobileImage: banner.mobileImage || '',
      ctaText: banner.ctaText || '',
      ctaLink: banner.ctaLink || '',
      theme: banner.theme,
      startDate: toLocalInputValue(banner.startDate),
      endDate: toLocalInputValue(banner.endDate),
      status: banner.status,
      priority: String(Number.isFinite(Number(banner.priority)) ? banner.priority : 100),
      targetCategory: banner.targetCategory || '',
      targetProductIds: (banner.targetProductIds || []).join(', '),
    });
  };

  const saveBanner = async () => {
    try {
      const payload = buildPayloadFromForm(form);
      setSaving(true);
      if (editId) {
        const updated = await updateHeroBannerApi(editId, payload);
        setRows((prev) => sortByPriority(prev.map((x) => (x.id === updated.id ? updated : x))));
        toast.success('Banner updated');
      } else {
        const created = await createHeroBannerApi(payload);
        setRows((prev) => sortByPriority([created, ...prev]));
        setEditId(created.id);
        toast.success('Banner created');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async (id: string) => {
    const ok = window.confirm('Delete this banner?');
    if (!ok) return;
    try {
      setBusyId(id);
      await deleteHeroBannerApi(id);
      setRows((prev) => prev.filter((x) => x.id !== id));
      if (editId === id) startNew();
      toast.success('Banner deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete banner');
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (b: SaleBanner) => {
    const nextStatus: SaleBannerStatus = b.status === 'disabled' ? 'live' : 'disabled';
    try {
      setBusyId(b.id);
      const next = await updateHeroBannerApi(b.id, { status: nextStatus });
      setRows((prev) => sortByPriority(prev.map((x) => (x.id === next.id ? next : x))));
      toast.success(nextStatus === 'live' ? 'Banner enabled' : 'Banner disabled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const moveBanner = async (index: number, dir: -1 | 1) => {
    const current = sortedRows[index];
    const other = sortedRows[index + dir];
    if (!current || !other) return;
    try {
      setBusyId(current.id);
      const [a, b] = await Promise.all([
        updateHeroBannerApi(current.id, { priority: other.priority }),
        updateHeroBannerApi(other.id, { priority: current.priority }),
      ]);
      setRows((prev) =>
        sortByPriority(
          prev.map((x) => {
            if (x.id === a.id) return a;
            if (x.id === b.id) return b;
            return x;
          })
        )
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder');
    } finally {
      setBusyId(null);
    }
  };

  const uploadDesktop = async (file?: File) => {
    if (!file) return;
    try {
      setUploadingDesktop(true);
      const url = await uploadProductImage(file, file.name || `sale-desktop-${Date.now()}.jpg`);
      setForm((p) => ({ ...p, desktopImage: url }));
      toast.success('Desktop image uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Desktop image upload failed');
    } finally {
      setUploadingDesktop(false);
      if (desktopFileRef.current) desktopFileRef.current.value = '';
    }
  };

  const uploadMobile = async (file?: File) => {
    if (!file) return;
    try {
      setUploadingMobile(true);
      const url = await uploadProductImage(file, file.name || `sale-mobile-${Date.now()}.jpg`);
      setForm((p) => ({ ...p, mobileImage: url }));
      toast.success('Mobile image uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mobile image upload failed');
    } finally {
      setUploadingMobile(false);
      if (mobileFileRef.current) mobileFileRef.current.value = '';
    }
  };

  const previewBanner: SaleBanner = {
    id: editId || 'preview',
    title: form.title || 'Banner title preview',
    subtitle: form.subtitle || 'Subtitle preview',
    desktopImage: form.desktopImage || '/placeholder.svg',
    mobileImage: form.mobileImage || '',
    ctaText: form.ctaText || 'Shop Now',
    ctaLink: form.ctaLink || '/category/trending',
    theme: form.theme,
    startDate: localInputToIso(form.startDate),
    endDate: localInputToIso(form.endDate),
    status: form.status,
    priority: Number(form.priority) || 100,
    targetCategory: form.targetCategory || '',
    targetProductIds: form.targetProductIds.split(',').map((x) => x.trim()).filter(Boolean),
  };
  const previewLifecycle = lifecycleStatus(previewBanner);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Hero / Sale Banner Manager</h1>
          <p className="text-sm text-muted-foreground">Create and manage live sale hero banners with schedule, priority and theme.</p>
        </div>
        <Button type="button" variant="outline" onClick={startNew}>
          <Plus className="mr-1.5 h-4 w-4" /> New Banner
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">First Slide Control</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose what appears first on homepage hero: automatic priority, default hero, or a specific sale banner.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="first-slide-mode">First slide mode</Label>
            <select
              id="first-slide-mode"
              value={firstSlideMode}
              onChange={(e) => setFirstSlideMode(e.target.value as HeroFirstSlideMode)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="auto">Auto (by priority)</option>
              <option value="default">Default hero first</option>
              <option value="banner">Selected sale first</option>
            </select>
          </div>

          <div>
            <Label htmlFor="first-slide-banner">Selected sale banner</Label>
            <select
              id="first-slide-banner"
              value={firstBannerId}
              onChange={(e) => setFirstBannerId(e.target.value)}
              disabled={firstSlideMode !== 'banner'}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Select banner</option>
              {firstSlideBannerOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button type="button" onClick={() => void saveFirstSlidePreference()} disabled={savingFirstSlide}>
              {savingFirstSlide ? 'Saving...' : 'Save First Slide'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editId ? 'Edit Banner' : 'Create Banner'}</h2>
            <Badge variant="outline" className={previewLifecycle.className}>{previewLifecycle.label}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="sale-title">Sale title</Label>
              <Input
                id="sale-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Summer Sale 2026"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="sale-subtitle">Subtitle / description</Label>
              <Input
                id="sale-subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                placeholder="Up to 60% off on selected collections"
              />
            </div>

            <div className="sm:col-span-2">
              <Label>Desktop banner image</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={form.desktopImage}
                  onChange={(e) => setForm((p) => ({ ...p, desktopImage: e.target.value }))}
                  placeholder="https://..."
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => desktopFileRef.current?.click()}
                  disabled={uploadingDesktop}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {uploadingDesktop ? 'Uploading...' : 'Upload'}
                </Button>
                <input
                  ref={desktopFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void uploadDesktop(e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label>Mobile banner image</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={form.mobileImage}
                  onChange={(e) => setForm((p) => ({ ...p, mobileImage: e.target.value }))}
                  placeholder="https://... (optional)"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => mobileFileRef.current?.click()}
                  disabled={uploadingMobile}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {uploadingMobile ? 'Uploading...' : 'Upload'}
                </Button>
                <input
                  ref={mobileFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void uploadMobile(e.target.files?.[0])}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sale-cta-text">CTA button text</Label>
              <Input
                id="sale-cta-text"
                value={form.ctaText}
                onChange={(e) => setForm((p) => ({ ...p, ctaText: e.target.value }))}
                placeholder="Shop Sale"
              />
            </div>
            <div>
              <Label htmlFor="sale-cta-link">CTA link</Label>
              <Input
                id="sale-cta-link"
                value={form.ctaLink}
                onChange={(e) => setForm((p) => ({ ...p, ctaLink: e.target.value }))}
                placeholder="/category/trending"
              />
            </div>

            <div>
              <Label htmlFor="sale-theme">Sale theme</Label>
              <select
                id="sale-theme"
                value={form.theme}
                onChange={(e) => setForm((p) => ({ ...p, theme: e.target.value as SaleBannerTheme }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {THEMES.map((theme) => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="sale-status">Status</Label>
              <select
                id="sale-status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as SaleBannerStatus }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="sale-start">Start date</Label>
              <Input
                id="sale-start"
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sale-end">End date</Label>
              <Input
                id="sale-end"
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="sale-priority">Priority/order number</Label>
              <Input
                id="sale-priority"
                type="number"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sale-target-category">Optional target category</Label>
              <Input
                id="sale-target-category"
                value={form.targetCategory}
                onChange={(e) => setForm((p) => ({ ...p, targetCategory: e.target.value }))}
                placeholder="fashion | home | printed..."
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="sale-target-products">Optional target product IDs (comma separated)</Label>
              <Input
                id="sale-target-products"
                value={form.targetProductIds}
                onChange={(e) => setForm((p) => ({ ...p, targetProductIds: e.target.value }))}
                placeholder="p123, p456"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveBanner()} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? 'Saving...' : editId ? 'Update Banner' : 'Create Banner'}
            </Button>
            {editId ? (
              <Button type="button" variant="outline" onClick={startNew}>
                <Plus className="mr-1.5 h-4 w-4" /> New banner form
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-lg font-semibold">Preview</h2>
          <div className="overflow-hidden rounded-xl border bg-muted/20">
            <div className="aspect-[16/9] bg-muted/40 p-2">
              <picture>
                {previewBanner.desktopImage ? <source media="(min-width: 768px)" srcSet={previewBanner.desktopImage} /> : null}
                <img
                  src={previewBanner.mobileImage || previewBanner.desktopImage || '/placeholder.svg'}
                  alt={previewBanner.title}
                  className="h-full w-full rounded-lg object-contain"
                />
              </picture>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{previewBanner.theme}</Badge>
                <Badge variant="outline" className={previewLifecycle.className}>{previewLifecycle.label}</Badge>
              </div>
              <h3 className="text-base font-bold">{previewBanner.title || 'Banner title'}</h3>
              <p className="text-sm text-muted-foreground">{previewBanner.subtitle || 'Subtitle preview will appear here.'}</p>
              <div className="text-xs text-muted-foreground">
                CTA: <span className="font-medium text-foreground">{previewBanner.ctaText || 'Shop Now'}</span> {'->'} {previewBanner.ctaLink || '/category/trending'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-lg font-semibold">All Banners</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading banners...</p>
        ) : sortedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No banners yet. Create your first sale banner above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-2">Banner</th>
                  <th className="px-2 py-2">Theme</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Priority</th>
                  <th className="px-2 py-2">Window</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((b, idx) => {
                  const life = lifecycleStatus(b);
                  return (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <img src={b.mobileImage || b.desktopImage || '/placeholder.svg'} alt="" className="h-10 w-16 rounded object-cover" />
                          <div>
                            <p className="font-medium">{b.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{b.subtitle || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 capitalize">{b.theme}</td>
                      <td className="px-2 py-3">
                        <Badge variant="outline" className={life.className}>{life.label}</Badge>
                      </td>
                      <td className="px-2 py-3">
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={String(b.priority)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((prev) => prev.map((x) => (x.id === b.id ? { ...x, priority: Number(val) || 0 } : x)));
                          }}
                          onBlur={async (e) => {
                            const n = Math.floor(Number(e.target.value));
                            if (!Number.isFinite(n)) return;
                            try {
                              setBusyId(b.id);
                              const next = await updateHeroBannerApi(b.id, { priority: n });
                              setRows((prev) => sortByPriority(prev.map((x) => (x.id === b.id ? next : x))));
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to update priority');
                              void loadRows();
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        />
                      </td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        <div>{new Date(b.startDate).toLocaleString()}</div>
                        <div>{new Date(b.endDate).toLocaleString()}</div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => beginEdit(b)} disabled={busyId === b.id}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void moveBanner(idx, -1)} disabled={idx === 0 || busyId === b.id}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void moveBanner(idx, 1)} disabled={idx === sortedRows.length - 1 || busyId === b.id}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void toggleStatus(b)} disabled={busyId === b.id}>
                            {b.status === 'disabled' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => void removeBanner(b.id)} disabled={busyId === b.id}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
