import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CustomerInfo, CartItem } from '@/types';
import { CheckCircle } from 'lucide-react';
import { cartItemsToOrderLines, createOrderApi } from '@/lib/ordersApi';
import { emailExistsApi, requestCheckoutOtpApi, verifyOtpApi } from '@/lib/authApi';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { lookupIndianPincode } from '@/lib/pincodeLookup';

function itemSummary(i: CartItem): string {
  const parts: string[] = [];
  if (i.selectedSize) parts.push(`Size ${i.selectedSize}`);
  if (i.selectedVariant) parts.push(String(i.selectedVariant));
  if (i.selectedSleeve) parts.push(String(i.selectedSleeve));
  if (i.customDesignName) parts.push(`Custom: ${i.customDesignName}`);
  return parts.join(' · ');
}

function simpleEmailValid(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function CheckoutPage() {
  const { items, subtotal, total, discount, couponCode, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [emailKnown, setEmailKnown] = useState<'unknown' | 'existing' | 'new'>('unknown');
  const [otpRequired, setOtpRequired] = useState(false);
  const lastOtpEmail = useRef<string | null>(null);
  const lastAutoCity = useRef<string | null>(null);
  const lastAutoState = useRef<string | null>(null);

  const set = (key: keyof CustomerInfo, val: string) => setForm(p => ({ ...p, [key]: val }));

  useEffect(() => {
    const pin = form.pincode.replace(/[^\d]/g, '').slice(0, 6);
    if (pin.length !== 6) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await lookupIndianPincode(pin);
        if (!r?.city) return;
        setForm(prev => {
          const currentCity = prev.city.trim();
          const shouldFill = !currentCity || (lastAutoCity.current && currentCity === lastAutoCity.current);
          const next: CustomerInfo = { ...prev };
          if (shouldFill) {
            lastAutoCity.current = r.city;
            next.city = r.city;
          }
          if (r.state) {
            const currentState = (prev.state || '').trim();
            const shouldFillState = !currentState || (lastAutoState.current && currentState === lastAutoState.current);
            if (shouldFillState) {
              lastAutoState.current = r.state;
              next.state = r.state;
            }
          }
          return next;
        });
      })();
    }, 450);
    return () => window.clearTimeout(t);
  }, [form.pincode]);

  // Background check: if email exists, skip OTP. If new email, auto-send OTP.
  useEffect(() => {
    const email = form.email.trim();
    if (!simpleEmailValid(email)) {
      setEmailKnown('unknown');
      setOtpRequired(false);
      setOtpChallengeId(null);
      setOtpVerified(false);
      setOtpCode('');
      lastOtpEmail.current = null;
      return;
    }

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const exists = await emailExistsApi(email);
          if (exists) {
            setEmailKnown('existing');
            setOtpRequired(false);
            setOtpChallengeId(null);
            setOtpVerified(false);
            setOtpCode('');
            lastOtpEmail.current = null;
            return;
          }

          setEmailKnown('new');
          setOtpRequired(true);
          if (lastOtpEmail.current === email && otpChallengeId) return;
          lastOtpEmail.current = email;
          setOtpBusy(true);
          try {
            const { challengeId } = await requestCheckoutOtpApi({
              email,
              name: form.name,
              phone: form.phone,
            });
            setOtpChallengeId(challengeId);
            setOtpVerified(false);
          } finally {
            setOtpBusy(false);
          }
        } catch {
          // Silent: don't block checkout form if the email check fails.
          setEmailKnown('unknown');
        }
      })();
    }, 500);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email]);

  const deliveryValid = useMemo(() => {
    return !!(form.name && form.email && form.phone && form.address && form.city && form.pincode && simpleEmailValid(form.email));
  }, [form]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpChallengeId) {
      toast.error('OTP session expired. Re-enter your email to resend.');
      return;
    }
    if (!otpCode || otpCode.length < 4) {
      toast.error('Enter the OTP code.');
      return;
    }
    setOtpBusy(true);
    try {
      await verifyOtpApi({
        challengeId: otpChallengeId,
        code: otpCode,
        name: form.name,
        phone: form.phone,
      });
      setOtpVerified(true);
      toast.success('Email verified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setOtpBusy(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!deliveryValid) {
      toast.error('Please fill all required fields');
      return;
    }
    if (otpRequired && !otpVerified) {
      toast.error('Please verify the OTP sent to your email');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createOrderApi({
        customer: { ...form, email: form.email.trim() },
        items: cartItemsToOrderLines(items),
        subtotal,
        discount,
        total,
        couponCode: couponCode || undefined,
        hasCustomPrint: items.some(i => !!(i.customDesignFile || i.customDesignName)),
      });
      clearCart();
      setOrderPlaced(created.id);
      toast.success('Your order has been placed successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="max-w-md mx-auto px-3 sm:px-4 py-16 sm:py-20 text-center">
        <CheckCircle className="h-12 sm:h-16 w-12 sm:w-16 text-primary mx-auto mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold mb-2">Order Confirmed!</h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-1">
          Order ID: <span className="font-mono font-semibold text-foreground break-all">{orderPlaced}</span>
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground mb-6">
          A confirmation email has been sent to your address. We&apos;ll update you when your order ships.
        </p>
        <Button onClick={() => navigate('/')} className="h-10 sm:h-11">Continue Shopping</Button>
      </div>
    );
  }

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Checkout</h1>
      <div className="flex flex-col md:grid md:grid-cols-5 gap-6 sm:gap-8">
        <form onSubmit={e => void handleVerifyOtp(e)} className="md:col-span-3 space-y-3 sm:space-y-4">
          <h2 className="font-semibold text-base">Delivery Details</h2>
          <Input placeholder="Full Name" value={form.name} onChange={e => set('name', e.target.value)} required className="h-11 sm:h-10" />
          <Input placeholder="Email" type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} required className="h-11 sm:h-10" />
          <Input placeholder="Phone Number" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required className="h-11 sm:h-10" />
          <Input placeholder="Full Address" value={form.address} onChange={e => set('address', e.target.value)} required className="h-11 sm:h-10" />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Pincode"
              value={form.pincode}
              onChange={e => set('pincode', e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              required
              className="h-11 sm:h-10"
            />
            <Input
              placeholder="City"
              value={form.city}
              onChange={e => {
                lastAutoCity.current = null;
                set('city', e.target.value);
              }}
              required
              className="h-11 sm:h-10"
            />
          </div>
          <Input
            placeholder="State"
            value={form.state || ''}
            onChange={e => {
              lastAutoState.current = null;
              set('state', e.target.value);
            }}
            className="h-11 sm:h-10"
          />

          {otpRequired && (
            <div className="border rounded-lg p-4 bg-muted/40 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <div className="font-semibold">Email verification</div>
                  <div className="text-muted-foreground text-xs">
                    {otpVerified
                      ? 'Verified'
                      : otpBusy
                        ? 'Sending OTP…'
                        : otpChallengeId
                          ? `OTP sent to ${form.email}`
                          : 'Preparing OTP…'}
                  </div>
                </div>
                {emailKnown === 'existing' && (
                  <div className="text-xs text-muted-foreground">Existing account</div>
                )}
              </div>

              {!otpVerified && (
                <>
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} containerClassName="mx-auto" className="w-full">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button type="submit" variant="outline" className="w-full" disabled={otpBusy || otpVerified || !otpChallengeId}>
                    {otpBusy ? 'Verifying…' : 'Verify OTP'}
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
            <p className="text-sm font-medium mb-1">Payment Method</p>
            <p className="text-sm text-muted-foreground">💵 Cash on Delivery (COD)</p>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full h-12 sm:h-11 text-sm sm:text-base font-semibold"
            disabled={submitting || !deliveryValid || (otpRequired && !otpVerified)}
            onClick={() => void handlePlaceOrder()}
          >
            {submitting ? 'Placing order…' : `Place Order — ₹${total}`}
          </Button>
        </form>

        <div className="md:col-span-2 border rounded-lg p-4 h-fit order-first md:order-none">
          <h2 className="font-semibold mb-3 text-base">Order Summary</h2>
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
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount</span>
                  <span>-₹{discount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
