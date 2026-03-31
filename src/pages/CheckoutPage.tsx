import { useCart } from '@/contexts/CartContext';
import { useOrders } from '@/contexts/OrdersContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Order, CustomerInfo, CartItem } from '@/types';
import { CheckCircle } from 'lucide-react';

function itemSummary(i: CartItem): string {
  const parts: string[] = [];
  if (i.selectedSize) parts.push(`Size ${i.selectedSize}`);
  if (i.selectedVariant) parts.push(String(i.selectedVariant));
  if (i.selectedSleeve) parts.push(String(i.selectedSleeve));
  if (i.customDesignName) parts.push(`Custom: ${i.customDesignName}`);
  return parts.join(' · ');
}

export default function CheckoutPage() {
  const { items, subtotal, total, discount, couponCode, clearCart } = useCart();
  const { orders, addOrder } = useOrders();
  const navigate = useNavigate();
  const [form, setForm] = useState<CustomerInfo>({ name: '', phone: '', address: '', city: '', pincode: '' });
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null);

  const set = (key: keyof CustomerInfo, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.address || !form.city || !form.pincode) {
      toast.error('Please fill all fields');
      return;
    }
    const orderId = `ORD${String(orders.length + 1).padStart(3, '0')}-${Date.now().toString(36).slice(-4)}`;
    const order: Order = {
      id: orderId,
      items,
      customer: form,
      status: 'pending',
      total,
      discount,
      couponCode: couponCode || undefined,
      createdAt: new Date().toISOString(),
      hasCustomPrint: items.some(i => !!i.customDesignFile),
    };
    addOrder(order);
    clearCart();
    setOrderPlaced(orderId);
    toast.success('Order placed successfully!');
  };

  if (orderPlaced) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-muted-foreground mb-1">Order ID: <span className="font-mono font-semibold text-foreground">{orderPlaced}</span></p>
        <p className="text-sm text-muted-foreground mb-6">You&apos;ll receive updates on WhatsApp.</p>
        <Button onClick={() => navigate('/')}>Continue Shopping</Button>
      </div>
    );
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Checkout</h1>
      <div className="grid md:grid-cols-5 gap-8">
        <form onSubmit={handleSubmit} className="md:col-span-3 space-y-4">
          <h2 className="font-semibold">Delivery Details</h2>
          <Input placeholder="Full Name" value={form.name} onChange={e => set('name', e.target.value)} required />
          <Input placeholder="Phone Number" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required />
          <Input placeholder="Full Address" value={form.address} onChange={e => set('address', e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} required />
            <Input placeholder="Pincode" value={form.pincode} onChange={e => set('pincode', e.target.value)} required />
          </div>
          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-sm font-medium mb-1">Payment Method</p>
            <p className="text-sm text-muted-foreground">💵 Cash on Delivery (COD)</p>
          </div>
          <Button type="submit" size="lg" className="w-full">Place Order — ₹{total}</Button>
        </form>

        <div className="md:col-span-2 border rounded-lg p-4 h-fit">
          <h2 className="font-semibold mb-3">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map(i => (
              <div key={i.cartLineId} className="flex justify-between gap-2">
                <span className="truncate pr-2">
                  {i.product.name} ×{i.quantity}
                  {itemSummary(i) && (
                    <span className="text-muted-foreground block text-xs truncate">{itemSummary(i)}</span>
                  )}
                </span>
                <span className="shrink-0">₹{i.product.price * i.quantity}</span>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₹{subtotal}</span></div>
              {discount > 0 && <div className="flex justify-between text-primary"><span>Discount</span><span>-₹{discount}</span></div>}
              <div className="flex justify-between font-bold"><span>Total</span><span>₹{total}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
