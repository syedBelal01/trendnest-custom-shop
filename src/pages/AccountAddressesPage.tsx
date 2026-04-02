import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { addAddressApi, deleteAddressApi, fetchMyAddressesApi, updateAddressApi, type Address } from '@/lib/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { lookupIndianPincode } from '@/lib/pincodeLookup';

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const lastAutoCity = useRef<string | null>(null);
  const lastAutoState = useRef<string | null>(null);

  const canAdd = useMemo(() => !!(address.trim() && city.trim() && pincode.trim()), [address, city, pincode]);

  useEffect(() => {
    const pin = pincode.replace(/[^\d]/g, '').slice(0, 6);
    if (pin.length !== 6) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await lookupIndianPincode(pin);
        if (!r?.city) return;
        setCity(prev => {
          const cur = prev.trim();
          const shouldFill = !cur || (lastAutoCity.current && cur === lastAutoCity.current);
          if (!shouldFill) return prev;
          lastAutoCity.current = r.city;
          return r.city;
        });
        if (r.state) {
          setState(prev => {
            const cur = prev.trim();
            const shouldFill = !cur || (lastAutoState.current && cur === lastAutoState.current);
            if (!shouldFill) return prev;
            lastAutoState.current = r.state!;
            return r.state!;
          });
        }
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [pincode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchMyAddressesApi();
        if (!mounted) return;
        setAddresses(list);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not load addresses');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      const next = await addAddressApi({ label: label.trim() || 'Home', address: address.trim(), city: city.trim(), state: state.trim() || undefined, pincode: pincode.trim(), isDefault: addresses.length === 0 });
      setAddresses(next);
      setAddress(''); setCity(''); setState(''); setPincode('');
      setShowForm(false);
      toast.success('Address added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add address');
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (id: string) => {
    setBusy(true);
    try {
      const next = await updateAddressApi(id, { isDefault: true });
      setAddresses(next);
      toast.success('Default address updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const next = await deleteAddressApi(id);
      setAddresses(next);
      toast.success('Address deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/account" className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Addresses</h1>
            <p className="text-xs text-muted-foreground">Manage delivery addresses</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="rounded-xl gap-1.5 h-9">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border bg-card shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Label</label>
              <Input value={label} onChange={e => setLabel(e.target.value)} className="h-10 rounded-xl" placeholder="Home" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pincode</label>
              <Input value={pincode} onChange={e => setPincode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} className="h-10 rounded-xl" placeholder="123456" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</label>
            <Input value={city} onChange={e => { lastAutoCity.current = null; setCity(e.target.value); }} className="h-10 rounded-xl" placeholder="City" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State</label>
            <Input value={state} onChange={e => { lastAutoState.current = null; setState(e.target.value); }} className="h-10 rounded-xl" placeholder="State" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Address</label>
            <Input value={address} onChange={e => setAddress(e.target.value)} className="h-10 rounded-xl" placeholder="Street, building, area" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1 h-10 rounded-xl">Cancel</Button>
            <Button disabled={!canAdd || busy} onClick={() => void add()} className="flex-1 h-10 rounded-xl">
              {busy ? 'Saving…' : 'Save Address'}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {addresses.length === 0 && !showForm ? (
        <div className="rounded-2xl border bg-card shadow-sm p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
            <MapPin className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(a => (
            <div key={a.id} className="rounded-2xl border bg-card shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{a.label}</span>
                      {a.isDefault && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">Default</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.address}</p>
                    <p className="text-xs text-muted-foreground">{a.city} — {a.pincode}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!a.isDefault && (
                    <button onClick={() => void setDefault(a.id)} disabled={busy} className="h-8 w-8 rounded-lg hover:bg-muted/50 flex items-center justify-center transition-colors" title="Set default">
                      <Star className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  <button onClick={() => void remove(a.id)} disabled={busy} className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-colors" title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
