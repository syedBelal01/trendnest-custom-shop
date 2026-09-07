import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  fetchAdminVendorsApi,
  patchAdminVendorApi,
  type Vendor,
  type VendorStatus,
} from '@/lib/vendorsApi';
import {
  fetchAdminVendorProductsApi,
  patchAdminVendorProductApi,
} from '@/lib/vendorProductsApi';
import { getAdminApiKey } from '@/lib/ordersApi';
import type { Product } from '@/types';

export default function AdminVendors() {
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!getAdminApiKey()) {
      toast.error('Set Admin API key first');
      return;
    }
    setLoading(true);
    try {
      const [list, products] = await Promise.all([
        fetchAdminVendorsApi(statusFilter === 'all' ? '' : statusFilter),
        fetchAdminVendorProductsApi(),
      ]);
      setVendors(list);
      setVendorProducts(products);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: VendorStatus) => {
    setBusyId(id);
    try {
      const updated = await patchAdminVendorApi(id, {
        status,
        rejectionReason: status === 'rejected' ? (rejectReason[id] || 'Application rejected') : undefined,
      });
      setVendors((prev) => prev.map((v) => (v.id === id ? updated : v)));
      toast.success(`Vendor ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-sm text-muted-foreground">Approve seller applications without affecting existing catalog.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VendorStatus | 'all')}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left p-3">Store</th>
              <th className="text-left p-3">Contact</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">GST / Bank</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  {loading ? 'Loading…' : 'No vendor applications yet.'}
                </td>
              </tr>
            )}
            {vendors.map((v) => (
              <tr key={v.id} className="border-t align-top">
                <td className="p-3">
                  <div className="font-medium">{v.storeName}</div>
                  <div className="text-xs text-muted-foreground">{v.id}</div>
                  <div className="text-xs text-muted-foreground">Commission {v.commissionPercent}%</div>
                </td>
                <td className="p-3">
                  <div>{v.contactName || '—'}</div>
                  <div className="text-xs text-muted-foreground">{v.contactEmail || '—'}</div>
                  <div className="text-xs text-muted-foreground">{v.contactPhone || '—'}</div>
                </td>
                <td className="p-3">
                  <div className="text-xs">{[v.city, v.state, v.pincode].filter(Boolean).join(', ') || '—'}</div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-[180px]">{v.address || ''}</div>
                </td>
                <td className="p-3 text-xs">
                  <div>GST: {v.gstin || '—'}</div>
                  <div>PAN: {v.pan || '—'}</div>
                  <div className="mt-1">{v.bankName || '—'} · {v.bankAccountNumberMasked || v.bankAccountNumber || '—'}</div>
                  <div>IFSC: {v.bankIfsc || '—'}</div>
                </td>
                <td className="p-3">
                  <span className="font-medium capitalize">{v.status}</span>
                  {v.rejectionReason ? (
                    <div className="text-xs text-destructive mt-1 max-w-[160px]">{v.rejectionReason}</div>
                  ) : null}
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    {(v.status === 'pending' || v.status === 'rejected' || v.status === 'suspended') && (
                      <Button
                        size="sm"
                        disabled={busyId === v.id}
                        onClick={() => void updateStatus(v.id, 'approved')}
                      >
                        Approve
                      </Button>
                    )}
                    {v.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === v.id}
                        onClick={() => void updateStatus(v.id, 'suspended')}
                      >
                        Suspend
                      </Button>
                    )}
                    {v.status !== 'rejected' && (
                      <>
                        <Input
                          placeholder="Reject reason"
                          value={rejectReason[v.id] || ''}
                          onChange={(e) => setRejectReason((m) => ({ ...m, [v.id]: e.target.value }))}
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === v.id}
                          onClick={() => void updateStatus(v.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 pt-4">
        <h2 className="text-lg font-semibold">Vendor product listings</h2>
        <p className="text-sm text-muted-foreground">Publish, unpublish, or reject products submitted by vendors.</p>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Price</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendorProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">No vendor products yet.</td>
                </tr>
              )}
              {vendorProducts.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </td>
                  <td className="p-3 text-xs">{p.vendorId || '—'}</td>
                  <td className="p-3">₹{p.price}</td>
                  <td className="p-3 capitalize">{p.approvalStatus || '—'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {p.approvalStatus === 'published' || p.approvalStatus === 'approved' ? (
                        <>
                          <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                            Published
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setBusyId(p.id);
                              void patchAdminVendorProductApi(p.id, { approvalStatus: 'under_review' })
                                .then((next) => {
                                  setVendorProducts((prev) => prev.map((x) => (x.id === p.id ? next : x)));
                                  toast.success('Unpublished — hidden from store');
                                })
                                .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                                .finally(() => setBusyId(null));
                            }}
                          >
                            Unpublish
                          </Button>
                        </>
                      ) : p.approvalStatus === 'rejected' ? (
                        <>
                          <span className="inline-flex h-8 items-center rounded-md border border-destructive/30 bg-destructive/10 px-3 text-xs font-medium text-destructive">
                            Rejected
                          </span>
                          <Button
                            size="sm"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setBusyId(p.id);
                              void patchAdminVendorProductApi(p.id, { approvalStatus: 'published' })
                                .then((next) => {
                                  setVendorProducts((prev) => prev.map((x) => (x.id === p.id ? next : x)));
                                  toast.success('Published');
                                })
                                .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                                .finally(() => setBusyId(null));
                            }}
                          >
                            Publish
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busyId === p.id}
                          onClick={() => {
                            setBusyId(p.id);
                            void patchAdminVendorProductApi(p.id, { approvalStatus: 'published' })
                              .then((next) => {
                                setVendorProducts((prev) => prev.map((x) => (x.id === p.id ? next : x)));
                                toast.success('Published');
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                              .finally(() => setBusyId(null));
                          }}
                        >
                          Publish
                        </Button>
                      )}
                      {p.approvalStatus !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === p.id}
                          onClick={() => {
                            setBusyId(p.id);
                            void patchAdminVendorProductApi(p.id, {
                              approvalStatus: 'rejected',
                              rejectionReason: 'Does not meet marketplace guidelines',
                            })
                              .then((next) => {
                                setVendorProducts((prev) => prev.map((x) => (x.id === p.id ? next : x)));
                                toast.success('Rejected');
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                              .finally(() => setBusyId(null));
                          }}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
