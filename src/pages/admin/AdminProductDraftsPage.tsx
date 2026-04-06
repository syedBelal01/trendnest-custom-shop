import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { listProductDraftsApi, deleteProductDraftApi, type ProductDraft } from '@/lib/adminDraftsApi';

export default function AdminProductDraftsPage() {
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<ProductDraft[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listProductDraftsApi('draft');
      setDrafts(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load drafts');
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (draftId: string) => {
    try {
      await deleteProductDraftApi(draftId);
      setDrafts(prev => prev.filter(d => d.draftId !== draftId));
      toast.success('Draft deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete draft');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Draft products</h1>
          <p className="text-sm text-muted-foreground">Autosaved step-by-step drafts. Publish when ready.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="text-sm text-muted-foreground">No drafts yet.</div>
      ) : (
        <div className="space-y-2">
          {drafts.map(d => (
            <div key={d.draftId} className="rounded-lg border bg-card p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {(String(d.details?.name ?? '') || 'Untitled draft') as string}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.categoryMain || 'No category'} {d.subcategory ? `• ${d.subcategory}` : ''} • Updated{' '}
                  {d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/admin/products/draft/${encodeURIComponent(d.draftId)}/step/1`}>
                  <Button size="sm">Continue</Button>
                </Link>
                <Button size="sm" variant="destructive" onClick={() => void remove(d.draftId)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

