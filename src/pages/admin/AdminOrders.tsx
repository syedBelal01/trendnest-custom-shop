import { useState } from 'react';
import { sampleOrders } from '@/data/mockData';
import { Order, OrderStatus } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([...sampleOrders]);
  const [filter, setFilter] = useState<string>('all');

  const updateStatus = (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    toast.success(`Order ${id} marked as ${status}`);
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        {filtered.map(o => (
          <div key={o.id} className="border rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <span className="font-mono font-semibold">{o.id}</span>
                <span className={`ml-2 inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[o.status]}`}>{o.status}</span>
                {o.hasCustomPrint && <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">🎨 Custom</span>}
              </div>
              <Select value={o.status} onValueChange={(v: OrderStatus) => updateStatus(o.id, v)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Customer:</span> {o.customer.name} • {o.customer.phone}</p>
              <p><span className="text-muted-foreground">Address:</span> {o.customer.address}, {o.customer.city} - {o.customer.pincode}</p>
              <p><span className="text-muted-foreground">Items:</span> {o.items.map(i => `${i.product.name} ×${i.quantity}`).join(', ')}</p>
              <p className="font-semibold">Total: ₹{o.total}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">No orders found.</p>}
      </div>
    </div>
  );
}
