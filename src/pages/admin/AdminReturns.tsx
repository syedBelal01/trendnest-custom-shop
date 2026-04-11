import { useCallback, useEffect, useState } from 'react';
import { useOrders } from '@/contexts/OrdersContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  listAdminReturnsApi,
  approveReturnApi,
  rejectReturnApi,
  setReverseShipmentApi,
  markReturnPickedUpApi,
  markReturnReceivedApi,
  refundReturnApi,
  type AdminReturnRow,
} from '@/lib/adminReturnsApi';

export default function AdminReturns() {
  const { adminKeySet } = useOrders();
  const [filter, setFilter] = useState<string>('requested');
  const [rows, setRows] = useState<AdminReturnRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminKeySet) return;
    setLoading(true);
    try {
      const list = await listAdminReturnsApi(filter || undefined);
      setRows(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [adminKeySet, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const keyOf = (r: AdminReturnRow) => `${r.orderId}::${r.returnRequest.returnId}`;

  const run = async (k: string, fn: () => Promise<unknown>) => {
    setBusyKey(k);
    try {
      await fn();
      toast.success('Updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyKey(null);
    }
  };

  if (!adminKeySet) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Returns</h1>
        <p className="text-muted-foreground">Set the admin API key above to manage return requests.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Returns</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="picked_up">Picked up</option>
            <option value="received">Received</option>
            <option value="refunded">Refunded</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-muted-foreground py-10">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-10">No return requests.</p>
      ) : (
        <div className="space-y-6">
          {rows.map(r => {
            const ret = r.returnRequest;
            const k = keyOf(r);
            const b = busyKey === k;
            return (
              <div key={k} className="border rounded-lg p-4 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-mono font-semibold">{r.orderId}</span>
                    <span className="text-muted-foreground mx-2">·</span>
                    <span className="font-mono text-xs">{ret.returnId}</span>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ret.status}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.customer?.name} · {r.customer?.email} · Payment: {r.paymentMethod === 'razorpay' ? 'Prepaid' : 'COD'}
                </p>
                <p>
                  <span className="text-muted-foreground">Reason:</span> {ret.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  Lines:{' '}
                  {(ret.lines || [])
                    .map(l => `${l.lineId}×${l.quantity}`)
                    .join(', ') || '—'}
                </p>
                {ret.status === 'requested' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={b}
                      onClick={() =>
                        void run(k, () => approveReturnApi(r.orderId, ret.returnId, ''))
                      }
                    >
                      Approve
                    </Button>
                    <RejectInline
                      disabled={b}
                      onReject={reason => run(k, () => rejectReturnApi(r.orderId, ret.returnId, reason))}
                    />
                  </div>
                ) : null}

                {['approved', 'picked_up', 'received'].includes(ret.status) && ret.status !== 'refunded' ? (
                  <ReverseShipmentForm
                    disabled={b}
                    initialAwb={ret.reverseShipment?.awb || ''}
                    initialCourier={ret.reverseShipment?.courierName || ''}
                    onSave={(awb, courierName) => run(k, () => setReverseShipmentApi(r.orderId, ret.returnId, { awb, courierName }))}
                  />
                ) : null}

                {ret.status === 'approved' ? (
                  <Button size="sm" variant="secondary" disabled={b} onClick={() => void run(k, () => markReturnPickedUpApi(r.orderId, ret.returnId))}>
                    Mark picked up
                  </Button>
                ) : null}

                {['approved', 'picked_up'].includes(ret.status) ? (
                  <Button size="sm" variant="secondary" disabled={b} onClick={() => void run(k, () => markReturnReceivedApi(r.orderId, ret.returnId))}>
                    Mark received (warehouse)
                  </Button>
                ) : null}

                {ret.status === 'received' && r.paymentMethod === 'razorpay' ? (
                  <Button size="sm" disabled={b} onClick={() => void run(k, () => refundReturnApi(r.orderId, ret.returnId))}>
                    Process Razorpay refund
                  </Button>
                ) : null}

                {['approved', 'picked_up', 'received'].includes(ret.status) && r.paymentMethod !== 'razorpay' ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={b}
                      onClick={() => void run(k, () => refundReturnApi(r.orderId, ret.returnId, 'manual'))}
                    >
                      Record manual refund
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={b}
                      onClick={() => void run(k, () => refundReturnApi(r.orderId, ret.returnId, 'store_credit'))}
                    >
                      Record store credit
                    </Button>
                  </div>
                ) : null}

                {Array.isArray(ret.timeline) && ret.timeline.length > 0 ? (
                  <div className="text-xs text-muted-foreground border-t pt-2 space-y-1 max-h-40 overflow-y-auto">
                    {ret.timeline
                      .slice()
                      .reverse()
                      .map((ev, i) => (
                        <div key={i}>
                          {ev.at ? new Date(ev.at).toLocaleString('en-IN') : '—'} — {ev.action} ({ev.actor})
                          {ev.note ? `: ${ev.note}` : ''}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RejectInline(props: { disabled: boolean; onReject: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!open) {
    return (
      <Button type="button" size="sm" variant="destructive" disabled={props.disabled} onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <Label className="text-xs">Rejection reason</Label>
        <Input className="h-8 w-56" value={reason} onChange={e => setReason(e.target.value)} placeholder="Required" />
      </div>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={props.disabled || !reason.trim()}
        onClick={() => void props.onReject(reason.trim()).then(() => setOpen(false))}
      >
        Confirm reject
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function ReverseShipmentForm(props: {
  disabled: boolean;
  initialAwb: string;
  initialCourier: string;
  onSave: (awb: string, courierName: string) => Promise<void>;
}) {
  const [awb, setAwb] = useState(props.initialAwb);
  const [courier, setCourier] = useState(props.initialCourier);
  return (
    <div className="rounded-md border p-3 space-y-2 bg-muted/20">
      <div className="text-xs font-semibold">Reverse shipment (pickup)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">AWB</Label>
          <Input className="h-8" value={awb} onChange={e => setAwb(e.target.value)} placeholder="Reverse AWB" />
        </div>
        <div>
          <Label className="text-xs">Courier name</Label>
          <Input className="h-8" value={courier} onChange={e => setCourier(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <Button type="button" size="sm" disabled={props.disabled || !awb.trim()} onClick={() => void props.onSave(awb.trim(), courier.trim())}>
        Save reverse AWB
      </Button>
    </div>
  );
}
