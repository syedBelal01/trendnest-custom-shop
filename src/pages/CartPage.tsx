import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { productImageForVariant } from '@/lib/productImages';
import { toast } from 'sonner';
import { validateCouponApi } from '@/lib/couponsApi';
import { usePaymentMethod } from '@/contexts/PaymentMethodContext';

export default function CartPage() {
  const { items, removeItem, updateQuantity, discount, couponCode, applyCoupon, unitPriceForItem, totalsForPaymentMethod } = useCart();
  const { method: paymentMethod, setMethod: setPaymentMethod } = usePaymentMethod();
  const [code, setCode] = useState('');

  const handleCoupon = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.error('Enter coupon code');
      return;
    }
    try {
      const computed = totalsForPaymentMethod(paymentMethod);
      const r = await validateCouponApi({
        code: trimmed,
        subtotal: computed.subtotal,
        items: items.map(i => ({ productId: i.product.id, quantity: i.quantity, selectedVariant: i.selectedVariant })),
      });
      applyCoupon(r.couponCode, r.discount);
      toast.success(`Coupon applied! You save ₹${r.discount}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid or expired coupon');
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-16 sm:py-20 text-center">
        <ShoppingBag className="h-12 sm:h-16 w-12 sm:w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">Add some products to get started!</p>
        <Link to="/"><Button className="h-10 sm:h-11">Continue Shopping</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Shopping Cart</h1>
      <div className="mb-4 rounded-lg border bg-card/40 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm font-medium">Price mode</div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="cartPriceMode" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
            <span className="text-muted-foreground">COD</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="cartPriceMode"
              checked={paymentMethod === 'razorpay'}
              onChange={() => setPaymentMethod('razorpay')}
            />
            <span className="text-muted-foreground">Online</span>
          </label>
        </div>
      </div>
      <div className="flex flex-col md:grid md:grid-cols-3 gap-6 sm:gap-8">
        {/* Cart items */}
        <div className="md:col-span-2 space-y-3 sm:space-y-4">
          {items.map(item => (
            <div key={item.cartLineId} className="flex gap-3 sm:gap-4 border rounded-lg p-3 sm:p-4">
              <img src={productImageForVariant(item.product, item.selectedVariant)} alt={item.product.name} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md shrink-0" />
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.product.id}`} className="font-medium text-sm hover:text-primary truncate block">{item.product.name}</Link>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {item.selectedSize && `Size: ${item.selectedSize}`}
                  {item.selectedVariant && ` • Color: ${item.selectedVariant}`}
                  {item.selectedSleeve && ` • ${item.selectedSleeve}`}
                </p>
                {item.customDesignName && <p className="text-xs text-primary mt-0.5 truncate">🎨 Custom: {item.customDesignName}</p>}
                <div className="flex items-center gap-2 sm:gap-3 mt-2">
                  <div className="flex items-center border rounded">
                    <button type="button" className="px-2.5 py-1.5 text-sm hover:bg-accent active:bg-accent/80 min-w-[2.25rem]" onClick={() => updateQuantity(item.cartLineId, item.quantity - 1)}>−</button>
                    <span className="px-2.5 sm:px-3 py-1.5 text-sm border-x tabular-nums">{item.quantity}</span>
                    <button type="button" className="px-2.5 py-1.5 text-sm hover:bg-accent active:bg-accent/80 min-w-[2.25rem]" onClick={() => updateQuantity(item.cartLineId, item.quantity + 1)}>+</button>
                  </div>
                  <span className="font-semibold text-sm">₹{unitPriceForItem(item, paymentMethod) * item.quantity}</span>
                  <button type="button" className="ml-auto text-muted-foreground hover:text-destructive p-1" onClick={() => removeItem(item.cartLineId)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="border rounded-lg p-4 sm:p-5 h-fit space-y-4">
          <h2 className="font-bold text-base">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{totalsForPaymentMethod(paymentMethod).subtotal}</span></div>
            {discount > 0 && <div className="flex justify-between text-primary"><span>Discount ({couponCode})</span><span>-₹{discount}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="text-primary">Free</span></div>
            <div className="border-t pt-2 flex justify-between font-bold text-base"><span>Total</span><span>₹{totalsForPaymentMethod(paymentMethod).total}</span></div>
          </div>
          <div className="flex gap-2">
            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Coupon code" className="h-10 sm:h-9 text-sm" />
            <Button variant="outline" size="sm" onClick={handleCoupon} className="h-10 sm:h-9 px-4">Apply</Button>
          </div>
          <Link to="/checkout" className="block"><Button className="w-full h-11 sm:h-10 text-sm font-semibold">Proceed to Checkout</Button></Link>
        </div>
      </div>
    </div>
  );
}
