import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addAddressApi, deleteAddressApi, fetchMyAddressesApi, updateAddressApi, type Address } from '@/lib/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const canAdd = useMemo(() => !!(address.trim() && city.trim() && pincode.trim()), [address, city, pincode]);

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
    return () => {
      mounted = false;
    };
  }, []);

  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    try {
      const next = await addAddressApi({ label: label.trim() || 'Home', address: address.trim(), city: city.trim(), pincode: pincode.trim(), isDefault: addresses.length === 0 });
      setAddresses(next);
      setAddress('');
      setCity('');
      setPincode('');
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

  if (loading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Address Book</h1>
        <p className="text-sm text-muted-foreground">Save delivery addresses for faster checkout.</p>
      </div>

      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Label</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} className="mt-2" placeholder="Home / Office" />
          </div>
          <div>
            <label className="text-sm font-medium">Pincode</label>
            <Input value={pincode} onChange={e => setPincode(e.target.value)} className="mt-2" placeholder="123456" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">City</label>
            <Input value={city} onChange={e => setCity(e.target.value)} className="mt-2" placeholder="City" />
          </div>
          <div>
            <label className="text-sm font-medium">Address</label>
            <Input value={address} onChange={e => setAddress(e.target.value)} className="mt-2" placeholder="Street / building / area" />
          </div>
        </div>
        <Button disabled={!canAdd || busy} onClick={() => void add()} className="w-full">
          {busy ? 'Saving…' : 'Add address'}
        </Button>
      </div>

      <div className="space-y-3">
        {addresses.map(a => (
          <div key={a.id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">
                {a.label}{' '}
                {a.isDefault && <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary">Default</span>}
              </div>
              <div className="text-muted-foreground">{a.address}</div>
              <div className="text-muted-foreground">{a.city} — {a.pincode}</div>
            </div>
            <div className="flex flex-col gap-2">
              {!a.isDefault && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void setDefault(a.id)}>
                  Set default
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void remove(a.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
        {addresses.length === 0 && <div className="text-center text-muted-foreground py-10">No saved addresses yet.</div>}
      </div>
    </div>
  );
}

