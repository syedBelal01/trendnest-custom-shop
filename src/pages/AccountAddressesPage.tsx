import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { addAddressApi, deleteAddressApi, fetchMyAddressesApi, updateAddressApi, type Address } from '@/lib/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  ChevronRight,
  Crosshair,
  MoreVertical,
  Plus,
  Search,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import { lookupIndianPincode } from '@/lib/pincodeLookup';
import { reverseGeocodeLatLng } from '@/lib/reverseGeocode';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AddressLabelIcon } from '@/components/address/AddressLabelIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IndianPhoneInput } from '@/components/forms/IndianPhoneInput';
import { isCompleteValidIndianMobile, isIndianPhoneValid, validateIndianPhone } from '@/lib/indianPhone';

function matchesAddressSearch(a: Address, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [a.label, a.recipientName, a.recipientPhone, a.address, a.city, a.state, a.pincode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(s);
}

export default function AccountAddressesPage() {
  const { refreshAuth } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('Home');
  const [editRecipientName, setEditRecipientName] = useState('');
  const [editRecipientPhone, setEditRecipientPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editDefault, setEditDefault] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const lastAutoCity = useRef<string | null>(null);
  const lastAutoState = useRef<string | null>(null);

  const filtered = useMemo(
    () => addresses.filter(a => matchesAddressSearch(a, searchQuery)),
    [addresses, searchQuery]
  );

  const canSaveDialog = useMemo(
    () =>
      !!(
        editRecipientName.trim() &&
        isCompleteValidIndianMobile(editRecipientPhone) &&
        editAddress.trim() &&
        editCity.trim() &&
        editPincode.trim()
      ),
    [editRecipientName, editRecipientPhone, editAddress, editCity, editPincode]
  );

  useEffect(() => {
    const pin = editPincode.replace(/[^\d]/g, '').slice(0, 6);
    if (pin.length !== 6 || !dialogOpen) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await lookupIndianPincode(pin);
        if (!r?.city) return;
        setEditCity(prev => {
          const cur = prev.trim();
          const shouldFill = !cur || (lastAutoCity.current && cur === lastAutoCity.current);
          if (!shouldFill) return prev;
          lastAutoCity.current = r.city;
          return r.city;
        });
        if (r.state) {
          setEditState(prev => {
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
  }, [editPincode, dialogOpen]);

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

  const openAddDialog = (preset?: { address?: string; city?: string; state?: string; pincode?: string }) => {
    setEditingId(null);
    setEditLabel('Home');
    setEditRecipientName('');
    setEditRecipientPhone('');
    setEditAddress(preset?.address ?? '');
    setEditCity(preset?.city ?? '');
    setEditState(preset?.state ?? '');
    setEditPincode(preset?.pincode ?? '');
    setEditDefault(addresses.length === 0);
    lastAutoCity.current = preset?.city ?? null;
    lastAutoState.current = preset?.state ?? null;
    setDialogOpen(true);
  };

  const openEditDialog = (a: Address) => {
    setEditingId(a.id);
    setEditLabel(a.label || 'Home');
    setEditRecipientName(a.recipientName?.trim() || '');
    setEditRecipientPhone(a.recipientPhone?.trim() || '');
    setEditAddress(a.address);
    setEditCity(a.city);
    setEditState(a.state || '');
    setEditPincode(a.pincode);
    setEditDefault(!!a.isDefault);
    lastAutoCity.current = null;
    lastAutoState.current = null;
    setDialogOpen(true);
  };

  const saveDialog = async () => {
    if (!canSaveDialog) return;
    const pv = validateIndianPhone(editRecipientPhone);
    if (!isIndianPhoneValid(pv)) {
      toast.error(pv.error);
      return;
    }
    setEditBusy(true);
    try {
      if (!editingId) {
        const next = await addAddressApi({
          label: editLabel.trim() || 'Home',
          recipientName: editRecipientName.trim(),
          recipientPhone: pv.digits,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim() || undefined,
          pincode: editPincode.trim(),
          isDefault: editDefault,
        });
        setAddresses(next);
        void refreshAuth();
        toast.success('Address added');
      } else {
        const next = await updateAddressApi(editingId, {
          label: editLabel.trim() || 'Home',
          recipientName: editRecipientName.trim(),
          recipientPhone: pv.digits,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim() || undefined,
          pincode: editPincode.trim(),
          isDefault: editDefault,
        });
        setAddresses(next);
        void refreshAuth();
        toast.success('Address updated');
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save address');
    } finally {
      setEditBusy(false);
    }
  };

  const setDefault = async (id: string) => {
    setBusy(true);
    try {
      const next = await updateAddressApi(id, { isDefault: true });
      setAddresses(next);
      void refreshAuth();
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
      void refreshAuth();
      toast.success('Address deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported in this browser');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords;
          const geo = await reverseGeocodeLatLng(latitude, longitude);
          if (geo) {
            openAddDialog({
              address: geo.address || '',
              city: geo.city || '',
              state: geo.state || '',
              pincode: geo.pincode || '',
            });
            toast.success('Location filled — add name, phone, and review the address');
          } else {
            openAddDialog();
            toast.message('Could not resolve address. Enter details manually.');
          }
        } catch {
          toast.error('Could not look up this location');
        } finally {
          setGeoBusy(false);
        }
      },
      () => {
        setGeoBusy(false);
        toast.error('Location permission denied or unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    );
  };

  const shareAddress = (a: Address) => {
    const lines = [
      a.recipientName,
      a.recipientPhone,
      [a.address, a.city, a.state, a.pincode].filter(Boolean).join(', '),
    ].filter(Boolean);
    const text = lines.join('\n');
    if (navigator.share) {
      void navigator.share({ title: a.label || 'Address', text }).catch(() => {
        void navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
      });
    } else {
      void navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
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
    <div className="max-w-lg mx-auto px-4 py-6 sm:py-8 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/account"
          className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Addresses</h1>
          <p className="text-xs text-muted-foreground">Manage delivery addresses</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search Address"
          className="h-11 pl-9 rounded-xl bg-background"
        />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border">
        <button
          type="button"
          disabled={geoBusy}
          onClick={() => void handleUseLocation()}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium hover:bg-muted/40 transition-colors disabled:opacity-60"
        >
          <Crosshair className="h-5 w-5 text-primary shrink-0" />
          {geoBusy ? 'Getting location…' : 'Use my Current Location'}
        </button>
        <button
          type="button"
          onClick={() => openAddDialog()}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium hover:bg-muted/40 transition-colors"
        >
          <Plus className="h-5 w-5 text-primary shrink-0" />
          <span className="flex-1">Add New Address</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </div>

      <div>
        <h2 className="text-sm font-bold mb-2">Saved Addresses</h2>
        {addresses.length === 0 ? (
          <div className="rounded-2xl border bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
            No saved addresses yet. Add one above.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-card shadow-sm p-6 text-center text-sm text-muted-foreground">
            No addresses match your search.
          </div>
        ) : (
          <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            {filtered.map((a, i) => (
              <div
                key={a.id}
                className={`px-4 py-3.5 ${i > 0 ? 'border-t border-dashed border-border' : ''}`}
              >
                <div className="flex gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground">
                    <AddressLabelIcon label={a.label || 'Other'} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-bold">{a.label || 'Address'}</span>
                      {a.isDefault && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    {a.recipientName?.trim() && (
                      <p className="text-sm text-foreground mt-1">{a.recipientName.trim()}</p>
                    )}
                    {a.recipientPhone?.trim() && (
                      <p className="text-sm text-muted-foreground">{a.recipientPhone.trim()}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {a.address}
                      <br />
                      {[a.city, a.state].filter(Boolean).join(', ')}
                      {a.pincode ? ` — ${a.pincode}` : ''}
                    </p>
                  </div>
                  <div className="flex items-start gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => shareAddress(a)}
                      className="h-8 w-8 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors"
                      title="Share or copy"
                    >
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg hover:bg-muted/60 flex items-center justify-center transition-colors"
                          title="More"
                        >
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(a)}>Edit</DropdownMenuItem>
                        {!a.isDefault && (
                          <DropdownMenuItem disabled={busy} onClick={() => void setDefault(a.id)}>
                            <Star className="h-3.5 w-3.5 mr-2" />
                            Set as default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={busy}
                          onClick={() => void remove(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit address' : 'Add address'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Label</label>
              <select
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Home">Home</option>
                <option value="Work">Work</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient name
              </label>
              <Input
                value={editRecipientName}
                onChange={e => setEditRecipientName(e.target.value)}
                placeholder="Full name"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phone number
              </label>
              <IndianPhoneInput value={editRecipientPhone} onChange={setEditRecipientPhone} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Street / area
              </label>
              <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Address" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</label>
                <Input
                  value={editCity}
                  onChange={e => {
                    lastAutoCity.current = null;
                    setEditCity(e.target.value);
                  }}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pincode</label>
                <Input
                  value={editPincode}
                  onChange={e => setEditPincode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">State</label>
              <Input
                value={editState}
                onChange={e => {
                  lastAutoState.current = null;
                  setEditState(e.target.value);
                }}
                className="h-10"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={editDefault} onCheckedChange={v => setEditDefault(v === true)} />
              Set as default address
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSaveDialog || editBusy} onClick={() => void saveDialog()}>
              {editBusy ? 'Saving…' : editingId ? 'Save changes' : 'Save address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
