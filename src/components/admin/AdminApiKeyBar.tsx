import { useState } from 'react';
import { useOrders } from '@/contexts/OrdersContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound } from 'lucide-react';

/**
 * Orders API uses X-Admin-Key (same value as ADMIN_API_KEY on the server).
 * Stored in sessionStorage only; never committed to the repo.
 */
export default function AdminApiKeyBar() {
  const { adminKeySet, setAdminApiKey, clearAdminApiKeyAndOrders, ordersLoading, ordersError, refreshOrders } = useOrders();
  const [draft, setDraft] = useState('');

  if (adminKeySet) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          Orders API key is set for this session.
          {ordersLoading && <span className="text-xs">Loading orders…</span>}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshOrders()} disabled={ordersLoading}>
            Refresh orders
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => clearAdminApiKeyAndOrders()}>
            Clear key
          </Button>
        </div>
        {ordersError && <p className="w-full text-xs text-destructive">{ordersError}</p>}
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-3 text-sm">
      <p className="font-medium text-amber-900 dark:text-amber-100">Orders & invoices</p>
      <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
        Enter the same secret as <code className="rounded bg-background/80 px-1">ADMIN_API_KEY</code> on your API server (Render .env) to load orders, update status, and download PDFs.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="password"
          className="max-w-md h-9"
          placeholder="Admin API key"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && draft.trim()) {
              setAdminApiKey(draft);
              setDraft('');
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={!draft.trim()}
          onClick={() => {
            setAdminApiKey(draft);
            setDraft('');
          }}
        >
          Save key
        </Button>
      </div>
    </div>
  );
}
