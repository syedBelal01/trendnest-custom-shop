import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { applyVendorApi, fetchMyVendorApi, type Vendor } from '@/lib/vendorsApi';

const emptyForm = {
  storeName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  pan: '',
  bankAccountHolder: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
};

export default function SellOnTrendNestPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const v = await fetchMyVendorApi();
        if (!cancelled) setVendor(v);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load vendor status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.message('Please log in to apply as a vendor');
      nav(`/login?redirect=${encodeURIComponent('/sell')}`);
      return;
    }
    if (!form.storeName.trim()) {
      toast.error('Store name is required');
      return;
    }
    setSubmitting(true);
    try {
      const v = await applyVendorApi(form);
      setVendor(v);
      toast.success('Application submitted — waiting for admin approval');
      nav('/vendor');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Application failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  if (vendor && vendor.status !== 'rejected') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <h1 className="text-2xl font-bold">Sell on TrendNest99</h1>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <p className="text-sm">
            You already applied as <strong>{vendor.storeName}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-semibold text-foreground">{vendor.status}</span>
          </p>
          {vendor.status === 'pending' && (
            <p className="text-sm text-muted-foreground">Our team will review your application soon.</p>
          )}
          {vendor.status === 'approved' && (
            <p className="text-sm text-emerald-700">You are eligible to sell. Open your vendor dashboard.</p>
          )}
          {vendor.status === 'suspended' && (
            <p className="text-sm text-destructive">Your seller account is suspended. Contact support.</p>
          )}
          <Button asChild className="mt-2">
            <Link to="/vendor">Go to Vendor Panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sell on TrendNest99</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Register as a vendor with basic business details. After admin approval you become eligible to list products.
        </p>
      </div>

      {!user && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You need an account to apply.{' '}
          <Link className="underline font-medium" to={`/login?redirect=${encodeURIComponent('/sell')}`}>
            Log in
          </Link>{' '}
          first.
        </div>
      )}

      {vendor?.status === 'rejected' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          Previous application was rejected
          {vendor.rejectionReason ? `: ${vendor.rejectionReason}` : '.'} You can update details and re-apply below.
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold mb-2">Business details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Store / Brand name *" value={form.storeName} onChange={set('storeName')} required />
            <Input placeholder="Contact person name" value={form.contactName} onChange={set('contactName')} />
            <Input placeholder="Contact email" type="email" value={form.contactEmail} onChange={set('contactEmail')} />
            <Input placeholder="Contact phone" value={form.contactPhone} onChange={set('contactPhone')} />
            <Input className="sm:col-span-2" placeholder="Address" value={form.address} onChange={set('address')} />
            <Input placeholder="City" value={form.city} onChange={set('city')} />
            <Input placeholder="State" value={form.state} onChange={set('state')} />
            <Input placeholder="Pincode" value={form.pincode} onChange={set('pincode')} />
            <Input placeholder="GSTIN (optional)" value={form.gstin} onChange={set('gstin')} />
            <Input placeholder="PAN (optional)" value={form.pan} onChange={set('pan')} />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Bank details <span className="font-normal text-muted-foreground">(optional)</span></p>
          <p className="text-xs text-muted-foreground mb-2">You can add these later before payouts. Not required to apply.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Account holder name (optional)" value={form.bankAccountHolder} onChange={set('bankAccountHolder')} />
            <Input placeholder="Bank name (optional)" value={form.bankName} onChange={set('bankName')} />
            <Input placeholder="Account number (optional)" value={form.bankAccountNumber} onChange={set('bankAccountNumber')} />
            <Input placeholder="IFSC (optional)" value={form.bankIfsc} onChange={set('bankIfsc')} />
          </div>
        </div>

        <Button type="submit" disabled={!user || submitting} className="w-full sm:w-auto">
          {submitting ? 'Submitting…' : vendor?.status === 'rejected' ? 'Re-submit application' : 'Submit application'}
        </Button>
      </form>
    </div>
  );
}
