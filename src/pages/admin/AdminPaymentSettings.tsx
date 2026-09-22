import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useOrders } from '@/contexts/OrdersContext';
import {
  fetchPaymentSettingsAdmin,
  patchPaymentSettingsAdmin,
  type PartialMode,
  type PaymentSettings,
} from '@/lib/paymentSettingsApi';

const defaults: PaymentSettings = {
  enableFullCod: true,
  enableFullOnline: true,
  enablePartial: false,
  partialMode: 'percentage',
  partialAmount: 0,
  partialPercent: 30,
};

export default function AdminPaymentSettings() {
  const { adminKeySet } = useOrders();
  const [form, setForm] = useState<PaymentSettings>(defaults);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!adminKeySet) return;
    setLoading(true);
    try {
      const s = await fetchPaymentSettingsAdmin();
      setForm(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  }, [adminKeySet]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form.enableFullCod && !form.enableFullOnline && !form.enablePartial) {
      toast.error('Enable at least one payment method');
      return;
    }
    if (form.enablePartial) {
      if (form.partialMode === 'amount' && !(Number(form.partialAmount) > 0)) {
        toast.error('Enter a partial advance amount greater than 0');
        return;
      }
      if (
        form.partialMode === 'percentage' &&
        (!(Number(form.partialPercent) > 0) || Number(form.partialPercent) > 100)
      ) {
        toast.error('Partial percent must be between 0 (exclusive) and 100');
        return;
      }
    }
    setSaving(true);
    try {
      const next = await patchPaymentSettingsAdmin(form);
      setForm(next);
      toast.success('Payment settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!adminKeySet) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Payment Settings</h1>
        <p className="text-muted-foreground">Set the admin API key above to manage payment methods.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payment Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which methods appear at checkout. Existing Full COD and Full Online flows stay unchanged.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Checkout methods</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Full COD</span>
          <Switch
            checked={form.enableFullCod}
            onCheckedChange={(v) => setForm((f) => ({ ...f, enableFullCod: v }))}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Full Online (Razorpay)</span>
          <Switch
            checked={form.enableFullOnline}
            onCheckedChange={(v) => setForm((f) => ({ ...f, enableFullOnline: v }))}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Partial Payment (advance online + COD remainder)</span>
          <Switch
            checked={form.enablePartial}
            onCheckedChange={(v) => setForm((f) => ({ ...f, enablePartial: v }))}
          />
        </label>
      </div>

      {form.enablePartial && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Partial advance rule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              value={form.partialMode}
              onValueChange={(v: PartialMode) => setForm((f) => ({ ...f, partialMode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage based</SelectItem>
                <SelectItem value="amount">Amount based (₹)</SelectItem>
              </SelectContent>
            </Select>
            {form.partialMode === 'percentage' ? (
              <Input
                type="number"
                min={0.01}
                max={100}
                step="0.01"
                placeholder="e.g. 30"
                value={form.partialPercent || ''}
                onChange={(e) => setForm((f) => ({ ...f, partialPercent: Number(e.target.value) }))}
              />
            ) : (
              <Input
                type="number"
                min={1}
                step="1"
                placeholder="e.g. 500"
                value={form.partialAmount || ''}
                onChange={(e) => setForm((f) => ({ ...f, partialAmount: Number(e.target.value) }))}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {form.partialMode === 'percentage'
              ? `Customer pays ${form.partialPercent || 0}% online now; rest COD on delivery.`
              : `Customer pays ₹${form.partialAmount || 0} online now; rest COD on delivery (must be less than order total).`}
          </p>
        </div>
      )}

      <Button type="button" disabled={saving || loading} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}
