import { useState } from 'react';
import { coupons as initialCoupons } from '@/data/mockData';
import { Coupon } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCoupons() {
  const [list, setList] = useState<Coupon[]>([...initialCoupons]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Coupon>>({ code: '', type: 'percentage', value: 10, minOrder: 500, isActive: true, expiresAt: '2026-12-31' });

  const save = () => {
    if (!form.code) { toast.error('Code required'); return; }
    const c: Coupon = { ...form, id: `c${Date.now()}` } as Coupon;
    setList(prev => [...prev, c]);
    setOpen(false);
    toast.success('Coupon created');
  };

  const toggle = (id: string) => setList(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  const remove = (id: string) => { setList(prev => prev.filter(c => c.id !== id)); toast.success('Coupon deleted'); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Coupons & Offers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Coupon</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Coupon</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Code (e.g. SAVE20)" value={form.code || ''} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              <Select value={form.type || 'percentage'} onValueChange={v => setForm(p => ({ ...p, type: v as Coupon['type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage Discount</SelectItem>
                  <SelectItem value="flat">Flat Discount (₹)</SelectItem>
                  <SelectItem value="free_delivery">Free Delivery</SelectItem>
                </SelectContent>
              </Select>
              {form.type !== 'free_delivery' && (
                <Input type="number" placeholder="Value" value={form.value || ''} onChange={e => setForm(p => ({ ...p, value: +e.target.value }))} />
              )}
              <Input type="number" placeholder="Min Order (₹)" value={form.minOrder || ''} onChange={e => setForm(p => ({ ...p, minOrder: +e.target.value }))} />
              <Input type="date" value={form.expiresAt || ''} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
              <Button onClick={save} className="w-full">Create Coupon</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr><th className="text-left p-3">Code</th><th className="text-left p-3">Type</th><th className="text-left p-3">Value</th><th className="text-left p-3">Min Order</th><th className="p-3">Active</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td className="p-3 capitalize">{c.type.replace('_', ' ')}</td>
                <td className="p-3">{c.type === 'percentage' ? `${c.value}%` : c.type === 'flat' ? `₹${c.value}` : '—'}</td>
                <td className="p-3">₹{c.minOrder}</td>
                <td className="p-3 text-center"><Switch checked={c.isActive} onCheckedChange={() => toggle(c.id)} /></td>
                <td className="p-3 text-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
