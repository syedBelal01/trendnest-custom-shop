import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { coupons } from '@/data/mockData';
import { toast } from 'sonner';

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, total, discount, couponCode, applyCoupon } = useCart();
  const [code, setCode] = useState('');

  const handleCoupon = () => {
    const coupon = coupons.find(c => c.code.toLowerCase() === code.toLowerCase() && c.isActive);
    if (!coupon) { toast.error('Invalid or expired coupon'); return; }
    if (subtotal < coupon.minOrder) { toast.error(`Min order ₹${coupon.minOrder} required`); return; }
    const disc = coupon.type === 'percentage' ? Math.round(subtotal * coupon.value / 100) : coupon.type === 'flat' ? coupon.value : 0;
    applyCoupon(coupon.code, disc);
    toast.success(`Coupon applied! You save ₹${disc}`);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-4">Add some products to get started!</p>
        <Link to="/"><Button>Continue Shopping</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Shopping Cart</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.product.id} className="flex gap-4 border rounded-lg p-4">
              <img src={item.product.images[0]} alt={item.product.name} className="w-20 h-20 object-cover rounded-md" />
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.product.id}`} className="font-medium text-sm hover:text-primary truncate block">{item.product.name}</Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.selectedSize && `Size: ${item.selectedSize}`} {item.selectedVariant && `• ${item.selectedVariant}`}
                </p>
                {item.customDesignName && <p className="text-xs text-primary mt-0.5">🎨 Custom: {item.customDesignName}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border rounded">
                    <button className="px-2 py-1 text-sm hover:bg-accent" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>−</button>
                    <span className="px-3 py-1 text-sm border-x">{item.quantity}</span>
                    <button className="px-2 py-1 text-sm hover:bg-accent" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>+</button>
                  </div>
                  <span className="font-semibold text-sm">₹{item.product.price * item.quantity}</span>
                  <button className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.product.id)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border rounded-lg p-5 h-fit space-y-4">
          <h2 className="font-bold">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>Discount ({couponCode})</span><span>-₹{discount}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-primary">Free</span></div>
            <div className="border-t pt-2 flex justify-between font-bold text-base"><span>Total</span><span>₹{total}</span></div>
          </div>
          <div className="flex gap-2">
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Coupon code" className="h-9" />
            <Button variant="outline" size="sm" onClick={handleCoupon}>Apply</Button>
          </div>
          <Link to="/checkout" className="block"><Button className="w-full">Proceed to Checkout</Button></Link>
        </div>
      </div>
    </div>
  );
}
