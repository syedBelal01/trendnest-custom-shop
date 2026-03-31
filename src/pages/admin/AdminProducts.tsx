import { useState } from 'react';
import { products as allProducts } from '@/data/mockData';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Edit, Plus } from 'lucide-react';
import { toast } from 'sonner';

const emptyProduct = (): Partial<Product> => ({
  name: '', description: '', price: 0, originalPrice: undefined, images: [''], category: 'fashion', subcategory: '', stock: 0, rating: 4, reviews: [], sizes: [], variants: [], tags: [],
});

export default function AdminProducts() {
  const [productsList, setProductsList] = useState<Product[]>([...allProducts]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [open, setOpen] = useState(false);

  const save = () => {
    if (!editing?.name || !editing.price) { toast.error('Name and price required'); return; }
    if (editing.id) {
      setProductsList(prev => prev.map(p => p.id === editing.id ? { ...p, ...editing } as Product : p));
      toast.success('Product updated');
    } else {
      const newP: Product = { ...emptyProduct(), ...editing, id: `p${Date.now()}`, reviews: [], rating: 4 } as Product;
      setProductsList(prev => [...prev, newP]);
      toast.success('Product added');
    }
    setOpen(false);
    setEditing(null);
  };

  const remove = (id: string) => {
    setProductsList(prev => prev.filter(p => p.id !== id));
    toast.success('Product deleted');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => setEditing(emptyProduct())}><Plus className="h-4 w-4" /> Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing?.id ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <Input placeholder="Product Name" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Description" value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" placeholder="Price (₹)" value={editing.price || ''} onChange={e => setEditing(p => ({ ...p, price: +e.target.value }))} />
                  <Input type="number" placeholder="Original Price" value={editing.originalPrice || ''} onChange={e => setEditing(p => ({ ...p, originalPrice: +e.target.value || undefined }))} />
                </div>
                <Input placeholder="Image URL" value={editing.images?.[0] || ''} onChange={e => setEditing(p => ({ ...p, images: [e.target.value] }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={editing.category || 'fashion'} onValueChange={v => setEditing(p => ({ ...p, category: v as Product['category'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fashion">Fashion</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="printed">Printed</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Stock" value={editing.stock || ''} onChange={e => setEditing(p => ({ ...p, stock: +e.target.value }))} />
                </div>
                <Input placeholder="Subcategory" value={editing.subcategory || ''} onChange={e => setEditing(p => ({ ...p, subcategory: e.target.value }))} />
                <Input placeholder="Sizes (comma separated)" value={editing.sizes?.join(',') || ''} onChange={e => setEditing(p => ({ ...p, sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                <Input placeholder="Variants (comma separated)" value={editing.variants?.join(',') || ''} onChange={e => setEditing(p => ({ ...p, variants: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
                <Button onClick={save} className="w-full">Save</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr><th className="text-left p-3">Product</th><th className="text-left p-3">Category</th><th className="text-left p-3">Price</th><th className="text-left p-3">Stock</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {productsList.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-3 flex items-center gap-2">
                  <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover" />
                  <span className="truncate max-w-[150px]">{p.name}</span>
                </td>
                <td className="p-3 capitalize">{p.category}</td>
                <td className="p-3">₹{p.price}</td>
                <td className="p-3">{p.stock}</td>
                <td className="p-3 text-center space-x-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing({ ...p }); setOpen(true); }}><Edit className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
