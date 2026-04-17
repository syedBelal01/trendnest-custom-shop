import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CustomerInfo, CartItem } from '@/types';
import {
  CheckCircle,
  ChevronRight,
  Crosshair,
  KeyRound,
  Lock,
  MapPin,
  MoreVertical,
  Navigation,
  Plus,
  Search,
  Share2,
  Star,
} from 'lucide-react';
import { cartItemsToOrderLines, createOrderApi } from '@/lib/ordersApi';
import { cancelRazorpayPaymentSessionApi, createRazorpayPaymentSessionApi, loadRazorpayCheckoutJs, verifyRazorpayPaymentApi } from '@/lib/razorpayApi';
import {
  addAddressApi,
  emailExistsApi,
  fetchMyAddressesApi,
  fetchMyOrdersApi,
  requestCheckoutOtpApi,
  setPasswordApi,
  updateAddressApi,
  verifyOtpApi,
  type Address,
} from '@/lib/authApi';
import { useAuth } from '@/contexts/AuthContext';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { fetchPublicHealthApi } from '@/lib/api';
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
import { usePaymentMethod } from '@/contexts/PaymentMethodContext';
import { useProducts } from '@/contexts/ProductsContext';
import { fetchShippingServiceabilityApi, isShippingServiceabilityError, type ShippingServiceabilityResult } from '@/lib/shippingApi';
import { IndianPhoneInput } from '@/components/forms/IndianPhoneInput';
import { clampIndianPhoneInput, isCompleteValidIndianMobile, isIndianPhoneValid, validateIndianPhone } from '@/lib/indianPhone';
import { validateCouponApi } from '@/lib/couponsApi';

const LAST_ORDER_ID_KEY = 'tn:last_order_id_v1';

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

function normAddr(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lastOrderMatchesSaved(c: CustomerInfo, addrs: Address[]): boolean {
  return addrs.some(
    a => normAddr(a.pincode) === normAddr(c.pincode) && normAddr(a.address) === normAddr(c.address)
  );
}

const SAVED_ADDR_PREFIX = 'saved:';

function matchesAddressSearch(a: Address, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const blob = [a.label, a.recipientName, a.recipientPhone, a.address, a.city, a.state, a.pincode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(s);
}

export default function CheckoutPage() {
  const { items, subtotal, total, discount, couponCode, clearCart, totalsForPaymentMethod, unitPriceForItem, reconcileWithStock, applyCoupon } = useCart();
  const navigate = useNavigate();
  const { refreshProducts } = useProducts();
  const { user, loading: authLoading, refreshAuth } = useAuth();
  const { method: paymentMethod, setMethod: setPaymentMethod } = usePaymentMethod();
  const [couponDraft, setCouponDraft] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
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
  const [checkoutNewPass, setCheckoutNewPass] = useState('');
  const [checkoutConfirmPass, setCheckoutConfirmPass] = useState('');
  const [checkoutPassBusy, setCheckoutPassBusy] = useState(false);
  const [checkoutPasswordSaved, setCheckoutPasswordSaved] = useState(false);
  const lastOtpEmail = useRef<string | null>(null);
  const lastAutoCity = useRef<string | null>(null);
  const lastAutoState = useRef<string | null>(null);

  useEffect(() => {
    setCouponDraft(couponCode ?? '');
  }, [couponCode]);

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [lastOrderCustomer, setLastOrderCustomer] = useState<CustomerInfo | null>(null);
  const [addressBookLoading, setAddressBookLoading] = useState(false);
  /** `saved:id` | `last-order` | `manual` */
  const [selectionKey, setSelectionKey] = useState<string>('manual');
  const checkoutAddressInitRef = useRef(false);

  const [editOpen, setEditOpen] = useState(false);
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

  const [geoBusy, setGeoBusy] = useState(false);
  const [mapPreview, setMapPreview] = useState<{ lat: number; lon: number } | null>(null);

  const [shippingQuote, setShippingQuote] = useState<ShippingServiceabilityResult | null>(null);
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  /** Mirrors server ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE (null until /api/health loads). */
  const [allowRelaxedShipping, setAllowRelaxedShipping] = useState<boolean | null>(null);

  const set = (key: keyof CustomerInfo, val: string) => setForm(p => ({ ...p, [key]: val }));

  const applyFromSaved = useCallback((u: NonNullable<typeof user>, addr: Address) => {
    setForm({
      name: (addr.recipientName && addr.recipientName.trim()) || u.name || '',
      email: u.email || '',
      phone: clampIndianPhoneInput((addr.recipientPhone && addr.recipientPhone.trim()) || u.phone || ''),
      address: addr.address,
      city: addr.city,
      state: addr.state || '',
      pincode: addr.pincode,
    });
  }, []);

  const applyFromLastOrder = useCallback((c: CustomerInfo) => {
    setForm({
      name: c.name,
      email: c.email,
      phone: clampIndianPhoneInput(c.phone || ''),
      address: c.address,
      city: c.city,
      state: c.state || '',
      pincode: c.pincode,
    });
  }, []);

  const selectDeliveryOption = useCallback(
    (key: string, addrs: Address[], last: CustomerInfo | null, u: NonNullable<typeof user>) => {
      setSelectionKey(key);
      if (key === 'manual') return;
      if (key === 'last-order' && last) {
        applyFromLastOrder(last);
        return;
      }
      if (key.startsWith(SAVED_ADDR_PREFIX)) {
        const id = key.slice(SAVED_ADDR_PREFIX.length);
        const a = addrs.find(x => x.id === id);
        if (a) applyFromSaved(u, a);
      }
    },
    [applyFromLastOrder, applyFromSaved]
  );

  useEffect(() => {
    if (!user || authLoading) return;
    if (checkoutAddressInitRef.current) return;
    checkoutAddressInitRef.current = true;

    void (async () => {
      setAddressBookLoading(true);
      try {
        const [addrs, orders] = await Promise.all([fetchMyAddressesApi(), fetchMyOrdersApi()]);
        setSavedAddresses(addrs);
        const last = orders[0]?.customer ?? null;
        setLastOrderCustomer(last);

        const def = addrs.find(a => a.isDefault) ?? addrs[0];

        if (def) {
          setSelectionKey(`${SAVED_ADDR_PREFIX}${def.id}`);
          applyFromSaved(user, def);
        } else if (last) {
          setSelectionKey('last-order');
          applyFromLastOrder(last);
        } else {
          setSelectionKey('manual');
          setForm(f => ({
            ...f,
            name: user.name || '',
            email: user.email || '',
            phone: clampIndianPhoneInput(user.phone || ''),
          }));
        }
      } catch {
        setSelectionKey('manual');
        setForm(f => ({
          ...f,
          name: user?.name || '',
          email: user?.email || '',
          phone: clampIndianPhoneInput(user?.phone || ''),
        }));
      } finally {
        setAddressBookLoading(false);
      }
    })();
  }, [user, authLoading, applyFromSaved, applyFromLastOrder]);

  const showLastOrderCard = !!(lastOrderCustomer && !lastOrderMatchesSaved(lastOrderCustomer, savedAddresses));
  const isLoggedInCheckout = !!user && !authLoading;
  const useAddressPicker = isLoggedInCheckout && selectionKey !== 'manual';

  const filteredSavedAddresses = useMemo(
    () => savedAddresses.filter(a => matchesAddressSearch(a, addressSearchQuery)),
    [savedAddresses, addressSearchQuery]
  );

  const openAddAddressDialog = () => {
    setEditingId(null);
    setEditLabel('Home');
    setEditRecipientName(user?.name?.trim() || '');
    setEditRecipientPhone(user?.phone?.trim() || '');
    setEditAddress('');
    setEditCity('');
    setEditState('');
    setEditPincode('');
    setEditDefault(savedAddresses.length === 0);
    setEditOpen(true);
  };

  const openEditAddress = (a: Address) => {
    setEditingId(a.id);
    setEditLabel(a.label || 'Home');
    setEditRecipientName((a.recipientName && a.recipientName.trim()) || user?.name?.trim() || '');
    setEditRecipientPhone((a.recipientPhone && a.recipientPhone.trim()) || user?.phone?.trim() || '');
    setEditAddress(a.address);
    setEditCity(a.city);
    setEditState(a.state || '');
    setEditPincode(a.pincode);
    setEditDefault(!!a.isDefault);
    setEditOpen(true);
  };

  const saveEditAddress = async (asNew: boolean) => {
    if (!editRecipientName.trim() || !editRecipientPhone.trim()) {
      toast.error('Recipient name and phone are required');
      return;
    }
    const recipientPv = validateIndianPhone(editRecipientPhone);
    if (!isIndianPhoneValid(recipientPv)) {
      toast.error(recipientPv.error);
      return;
    }
    if (!editAddress.trim() || !editCity.trim() || !editPincode.trim()) {
      toast.error('Address, city, and pincode are required');
      return;
    }
    setEditBusy(true);
    try {
      if (!editingId) {
        const list = await addAddressApi({
          label: editLabel.trim() || 'Home',
          recipientName: editRecipientName.trim(),
          recipientPhone: recipientPv.digits,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim() || undefined,
          pincode: editPincode.trim(),
          isDefault: editDefault,
        });
        setSavedAddresses(list);
        const created = list[list.length - 1];
        if (created && user) {
          setSelectionKey(`${SAVED_ADDR_PREFIX}${created.id}`);
          applyFromSaved(user, created);
        }
        toast.success('Address saved');
      } else if (asNew) {
        const list = await addAddressApi({
          label: editLabel.trim() || 'Home',
          recipientName: editRecipientName.trim(),
          recipientPhone: recipientPv.digits,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim() || undefined,
          pincode: editPincode.trim(),
          isDefault: editDefault,
        });
        setSavedAddresses(list);
        const created = list[list.length - 1];
        if (created && user) {
          setSelectionKey(`${SAVED_ADDR_PREFIX}${created.id}`);
          applyFromSaved(user, created);
        }
        toast.success('New address saved');
      } else {
        const list = await updateAddressApi(editingId, {
          label: editLabel.trim() || 'Home',
          recipientName: editRecipientName.trim(),
          recipientPhone: recipientPv.digits,
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim() || undefined,
          pincode: editPincode.trim(),
          isDefault: editDefault,
        });
        setSavedAddresses(list);
        const updated = list.find(x => x.id === editingId);
        if (updated && user) {
          setSelectionKey(`${SAVED_ADDR_PREFIX}${updated.id}`);
          applyFromSaved(user, updated);
        }
        toast.success('Address updated');
      }
      setEditOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save address');
    } finally {
      setEditBusy(false);
    }
  };

  const shareSavedAddress = (a: Address) => {
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

  const setDefaultAddress = async (id: string) => {
    try {
      const list = await updateAddressApi(id, { isDefault: true });
      setSavedAddresses(list);
      toast.success('Default address updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
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
          setMapPreview({ lat: latitude, lon: longitude });
          setSelectionKey('manual');
          setForm(f => ({
            ...f,
            address: geo?.address || f.address,
            city: geo?.city || f.city,
            state: geo?.state || f.state,
            pincode: geo?.pincode || f.pincode,
          }));
          if (geo) {
            toast.success('Location applied — review your address before ordering');
          } else {
            toast.message('Could not resolve address from coordinates. Please enter manually.');
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const h = await fetchPublicHealthApi();
        if (!cancelled) setAllowRelaxedShipping(!!h.allowCheckoutWithoutShippingQuote);
      } catch {
        if (!cancelled) setAllowRelaxedShipping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkoutMerchandise = useMemo(
    () => totalsForPaymentMethod(paymentMethod),
    [paymentMethod, totalsForPaymentMethod]
  );

  const deliveryPinValid = form.pincode.replace(/\D/g, '').length === 6;
  const healthShippingLoaded = allowRelaxedShipping !== null;
  /** Successful serviceability response including a delivery estimate (required before checkout when not relaxed). */
  const shippingQuoteHasEta =
    shippingQuote?.ok === true &&
    ((shippingQuote.estimatedDeliveryDays != null && Number.isFinite(Number(shippingQuote.estimatedDeliveryDays))) ||
      (!!shippingQuote.estimatedDeliveryDate && !Number.isNaN(new Date(shippingQuote.estimatedDeliveryDate).getTime())));
  const shippingGateReady =
    deliveryPinValid &&
    healthShippingLoaded &&
    (allowRelaxedShipping === true || (!shippingQuoteLoading && shippingQuoteHasEta));

  const shippingChargeForTotal = 0;
  const payableGrandTotal = checkoutMerchandise.total;

  // Shiprocket serviceability — clear stale quotes while pin / cart / payment changes, then refetch.
  useEffect(() => {
    const pin = form.pincode.replace(/[^\d]/g, '').slice(0, 6);
    if (pin.length !== 6) {
      setShippingQuote(null);
      setShippingQuoteLoading(false);
      return;
    }
    if (items.length === 0) {
      setShippingQuote(null);
      setShippingQuoteLoading(false);
      return;
    }
    setShippingQuote(null);
    setShippingQuoteLoading(true);
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const computed = totalsForPaymentMethod(paymentMethod);
          const q = await fetchShippingServiceabilityApi({
            pincode: pin,
            items,
            paymentMethod,
            goodsAfterDiscount: computed.total,
            subtotal: computed.subtotal,
            total: computed.total,
          });
          if (!cancelled) setShippingQuote(q);
        } catch {
          if (!cancelled) setShippingQuote({ ok: false, reason: 'unavailable', error: 'Shipping service temporarily unavailable' });
        } finally {
          if (!cancelled) setShippingQuoteLoading(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      setShippingQuoteLoading(false);
    };
  }, [form.pincode, paymentMethod, items, discount, totalsForPaymentMethod]);

  // Background check: if email exists, skip OTP. If new email, auto-send OTP.
  useEffect(() => {
    const email = form.email.trim();
    if (!simpleEmailValid(email)) {
      setEmailKnown('unknown');
      setOtpRequired(false);
      setOtpChallengeId(null);
      setOtpVerified(false);
      setOtpCode('');
      setCheckoutNewPass('');
      setCheckoutConfirmPass('');
      setCheckoutPasswordSaved(false);
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
            setCheckoutPasswordSaved(false);
            setCheckoutNewPass('');
            setCheckoutConfirmPass('');
            lastOtpEmail.current = null;
            return;
          }

          setEmailKnown('new');
          setOtpRequired(true);
          if (lastOtpEmail.current === email && otpChallengeId) return;
          lastOtpEmail.current = email;
          setOtpBusy(true);
          try {
            const pv = validateIndianPhone(form.phone);
            const { challengeId } = await requestCheckoutOtpApi({
              email,
              name: form.name,
              phone: pv.ok ? pv.digits : undefined,
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
    return !!(
      form.name &&
      form.email &&
      form.phone &&
      isCompleteValidIndianMobile(form.phone) &&
      form.address &&
      form.city &&
      form.pincode &&
      simpleEmailValid(form.email)
    );
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
    const checkoutPhone = validateIndianPhone(form.phone);
    if (!isIndianPhoneValid(checkoutPhone)) {
      toast.error(checkoutPhone.error);
      return;
    }
    setOtpBusy(true);
    try {
      await verifyOtpApi({
        challengeId: otpChallengeId,
        code: otpCode,
        name: form.name,
        phone: checkoutPhone.digits,
      });
      setOtpVerified(true);
      setCheckoutPasswordSaved(false);
      setCheckoutNewPass('');
      setCheckoutConfirmPass('');
      toast.success('Email verified');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleCheckoutSavePassword = async () => {
    if (!checkoutNewPass || checkoutNewPass.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (checkoutNewPass !== checkoutConfirmPass) {
      toast.error('Passwords do not match');
      return;
    }
    setCheckoutPassBusy(true);
    try {
      await setPasswordApi({ password: checkoutNewPass });
      await refreshAuth();
      setCheckoutPasswordSaved(true);
      setCheckoutNewPass('');
      setCheckoutConfirmPass('');
      toast.success('Password saved — you can sign in with this email next time.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save password');
    } finally {
      setCheckoutPassBusy(false);
    }
  };

  const handlePlaceOrder = async () => {
    const reconciled = reconcileWithStock();
    if (reconciled.removed > 0) {
      toast.message('Some items were removed because they are out of stock.');
      if (items.length - reconciled.removed <= 0) {
        navigate('/cart');
        return;
      }
    }
    if (!deliveryValid) {
      toast.error('Please fill all required fields');
      return;
    }
    const phoneCheck = validateIndianPhone(form.phone);
    if (!isIndianPhoneValid(phoneCheck)) {
      toast.error(phoneCheck.error);
      return;
    }
    if (otpRequired && !otpVerified) {
      toast.error('Please verify the OTP sent to your email');
      return;
    }
    if (!shippingGateReady) {
      toast.error('Wait for shipping cost and delivery estimate before placing your order.');
      return;
    }
    if (shippingQuoteLoading) {
      toast.error('Wait for shipping cost and delivery estimate to finish updating.');
      return;
    }
    setSubmitting(true);
    try {
      const computed = totalsForPaymentMethod(paymentMethod);
      const payableTotal = computed.total;
      const payload = {
        customer: { ...form, email: form.email.trim(), phone: phoneCheck.digits },
        items: cartItemsToOrderLines(items).map((l, idx) => ({ ...l, price: unitPriceForItem(items[idx], paymentMethod) })),
        subtotal: computed.subtotal,
        discount,
        total: payableTotal,
        couponCode: couponCode || undefined,
        hasCustomPrint: items.some(i => !!(i.customDesignFile || i.customDesignName)),
        paymentMethod,
      } as const;

      if (paymentMethod === 'cod') {
        const created = await createOrderApi(payload);
        clearCart();
        await refreshProducts();
        window.dispatchEvent(new CustomEvent('trendnest:products-updated'));
        sessionStorage.setItem(LAST_ORDER_ID_KEY, created.id);
        setOrderPlaced(created.id);
        navigate('/checkout/success', { replace: true, state: { orderId: created.id } });
        return;
      }

      // Online payment flow
      await loadRazorpayCheckoutJs();
      const rp = await createRazorpayPaymentSessionApi(payload);
      const options = {
        key: rp.keyId,
        amount: rp.amount,
        currency: rp.currency,
        name: 'TrendNest',
        description: 'Secure payment',
        order_id: rp.razorpayOrderId,
        prefill: {
          name: form.name,
          email: form.email.trim(),
          contact: phoneCheck.digits,
        },
        notes: { sessionId: rp.sessionId },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await verifyRazorpayPaymentApi({
              sessionId: rp.sessionId,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            clearCart();
            await refreshProducts();
            window.dispatchEvent(new CustomEvent('trendnest:products-updated'));
            sessionStorage.setItem(LAST_ORDER_ID_KEY, verified.order.id);
            setOrderPlaced(verified.order.id);
            navigate('/checkout/success', { replace: true, state: { orderId: verified.order.id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            void cancelRazorpayPaymentSessionApi(rp.sessionId).catch(() => {});
            toast.message('Payment cancelled. No order was created.');
          },
        },
      };

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) throw new Error('Razorpay is not available');
      const rzp = new RazorpayCtor(options);
      rzp.on?.('payment.failed', () => {
        void cancelRazorpayPaymentSessionApi(rp.sessionId).catch(() => {});
        toast.error('Payment failed. Your order is still pending payment.');
      });
      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not place order');
    } finally {
      setSubmitting(false);
    }
  };

  const applyCheckoutCoupon = async () => {
    const trimmed = couponDraft.trim();
    if (!trimmed) {
      toast.error('Enter coupon code');
      return;
    }
    setCouponBusy(true);
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
    } finally {
      setCouponBusy(false);
    }
  };

  if (orderPlaced) return null;

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Checkout</h1>
      {allowRelaxedShipping === true && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
        >
          <strong className="font-semibold">Relaxed checkout (non-production).</strong> ALLOW_CHECKOUT_WITHOUT_SHIPPING_QUOTE
          is enabled on the API. Payable totals use ₹0 shipping until a real Shiprocket quote exists; the backend finalizes
          charges after order creation. Keep this flag <strong className="font-semibold">false</strong> in production unless
          you explicitly need a fallback.
        </div>
      )}
      <div className="flex flex-col md:grid md:grid-cols-5 gap-6 sm:gap-8">
        <form onSubmit={e => void handleVerifyOtp(e)} className="md:col-span-3 space-y-3 sm:space-y-4">
          <h2 className="font-semibold text-base">Delivery Details</h2>

          {addressBookLoading && isLoggedInCheckout && (
            <div className="text-sm text-muted-foreground py-2">Loading your addresses…</div>
          )}

          {!isLoggedInCheckout || selectionKey === 'manual' ? (
            <>
              <Input placeholder="Full Name" value={form.name} onChange={e => set('name', e.target.value)} required className="h-11 sm:h-10" />
              <Input placeholder="Email" type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)} required className="h-11 sm:h-10" />
              <div className="space-y-1">
                <IndianPhoneInput
                  placeholder="10-digit mobile"
                  value={form.phone}
                  onChange={v => set('phone', v)}
                  required
                  className="h-11 sm:h-10"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="checkout-confirm-email">
                Order confirmation email
              </label>
              <p className="text-xs text-muted-foreground">
                Not stored on this address — used for receipts and OTP if needed.
              </p>
              <Input
                id="checkout-confirm-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                className="h-11 sm:h-10"
              />
            </div>
          )}

          {isLoggedInCheckout && !addressBookLoading && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={addressSearchQuery}
                  onChange={e => setAddressSearchQuery(e.target.value)}
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
                  onClick={() => openAddAddressDialog()}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium hover:bg-muted/40 transition-colors"
                >
                  <Plus className="h-5 w-5 text-primary shrink-0" />
                  <span className="flex-1">Add New Address</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {mapPreview && (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.google.com/maps?q=${mapPreview.lat},${mapPreview.lon}&z=16`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open pin on map
                    </a>
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      [form.address, form.city, form.state, form.pincode].filter(Boolean).join(', ') || 'India'
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Pick on map
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setSelectionKey('manual');
                    setMapPreview(null);
                  }}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Type address manually
                </Button>
                <Button type="button" variant="secondary" size="sm" asChild>
                  <Link to="/account/addresses">Manage in account</Link>
                </Button>
              </div>

              {mapPreview && (
                <div className="rounded-md overflow-hidden border aspect-[21/9] max-h-40 bg-muted">
                  <iframe
                    title="Location preview"
                    className="w-full h-full min-h-[140px] border-0"
                    loading="lazy"
                    src={`https://www.google.com/maps?q=${mapPreview.lat},${mapPreview.lon}&z=15&output=embed`}
                  />
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold mb-2 flex items-center justify-between gap-2">
                  <span>Saved Addresses</span>
                </h3>
                <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                  {showLastOrderCard && lastOrderCustomer && (
                    <button
                      type="button"
                      onClick={() => user && selectDeliveryOption('last-order', savedAddresses, lastOrderCustomer, user)}
                      className={`w-full text-left px-4 py-3.5 transition-colors ${
                        selectionKey === 'last-order' ? 'bg-primary/5' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold">Last order delivery</span>
                            {selectionKey === 'last-order' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                Selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {lastOrderCustomer.name && (
                              <>
                                {lastOrderCustomer.name}
                                <br />
                              </>
                            )}
                            {lastOrderCustomer.phone && (
                              <>
                                {lastOrderCustomer.phone}
                                <br />
                              </>
                            )}
                            {lastOrderCustomer.address}, {lastOrderCustomer.city}
                            {lastOrderCustomer.state ? `, ${lastOrderCustomer.state}` : ''} — {lastOrderCustomer.pincode}
                          </p>
                        </div>
                      </div>
                    </button>
                  )}

                  {savedAddresses.length === 0 && !showLastOrderCard ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">No saved addresses yet.</div>
                  ) : savedAddresses.length > 0 && filteredSavedAddresses.length === 0 ? (
                    <div
                      className={`px-4 py-6 text-center text-sm text-muted-foreground ${
                        showLastOrderCard && lastOrderCustomer ? 'border-t border-dashed border-border' : ''
                      }`}
                    >
                      No addresses match your search.
                    </div>
                  ) : (
                    filteredSavedAddresses.map((a, i) => {
                      const key = `${SAVED_ADDR_PREFIX}${a.id}`;
                      const selected = selectionKey === key;
                      const showDashTop = i > 0 || !!(showLastOrderCard && lastOrderCustomer);
                      return (
                        <div
                          key={a.id}
                          className={showDashTop ? 'border-t border-dashed border-border' : ''}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (user) selectDeliveryOption(key, savedAddresses, lastOrderCustomer, user);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (user) selectDeliveryOption(key, savedAddresses, lastOrderCustomer, user);
                              }
                            }}
                            className={`w-full text-left px-4 py-3.5 cursor-pointer transition-colors ${
                              selected ? 'bg-primary/5' : 'hover:bg-muted/40'
                            }`}
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
                                  {selected && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                {(a.recipientName && a.recipientName.trim()) || (a.recipientPhone && a.recipientPhone.trim()) ? (
                                  <>
                                    {a.recipientName?.trim() && (
                                      <p className="text-sm text-foreground mt-1">{a.recipientName.trim()}</p>
                                    )}
                                    {a.recipientPhone?.trim() && (
                                      <p className="text-sm text-muted-foreground">{a.recipientPhone.trim()}</p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                    Add name and phone when you edit this address.
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                  {a.address}
                                  <br />
                                  {[a.city, a.state].filter(Boolean).join(', ')}
                                  {a.pincode ? ` — ${a.pincode}` : ''}
                                </p>
                              </div>
                              <div
                                className="flex items-start gap-0.5 shrink-0"
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => shareSavedAddress(a)}
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
                                    <DropdownMenuItem onClick={() => openEditAddress(a)}>Edit</DropdownMenuItem>
                                    {!a.isDefault && (
                                      <DropdownMenuItem onClick={() => void setDefaultAddress(a.id)}>
                                        <Star className="h-3.5 w-3.5 mr-2" />
                                        Set as default
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {(!useAddressPicker || selectionKey === 'manual') && (
            <>
              {isLoggedInCheckout && selectionKey === 'manual' && (
                <p className="text-xs text-muted-foreground">Enter your delivery address below.</p>
              )}
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
            </>
          )}

          {useAddressPicker && (
            <div className="rounded-lg border bg-card p-3 text-sm space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivering to</div>
              {form.name.trim() ? <p className="text-foreground font-medium">{form.name.trim()}</p> : null}
              {form.phone.trim() ? <p className="text-foreground">{form.phone.trim()}</p> : null}
              {form.email.trim() ? (
                <p className="text-muted-foreground text-xs break-all">{form.email.trim()}</p>
              ) : null}
              <p className="text-foreground leading-relaxed pt-2 border-t border-border/70">
                {form.address}, {form.city}
                {form.state ? `, ${form.state}` : ''} — {form.pincode}
              </p>
            </div>
          )}

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

              {otpVerified && emailKnown === 'new' && (
                <div className="border-t border-border pt-4 mt-2 space-y-3">
                  <div className="flex items-start gap-2">
                    <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold">Create a password (optional)</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Save a password now to sign in with this email on future visits. You can skip this and still place your order.
                      </p>
                    </div>
                  </div>
                  {checkoutPasswordSaved ? (
                    <p className="text-xs text-primary font-medium">Password saved. You can continue to place your order.</p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="password"
                            value={checkoutNewPass}
                            onChange={e => setCheckoutNewPass(e.target.value)}
                            placeholder="At least 8 characters"
                            className="pl-10 h-10"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="password"
                            value={checkoutConfirmPass}
                            onChange={e => setCheckoutConfirmPass(e.target.value)}
                            placeholder="Repeat password"
                            className="pl-10 h-10"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={checkoutPassBusy}
                        onClick={() => void handleCheckoutSavePassword()}
                      >
                        {checkoutPassBusy ? 'Saving…' : 'Save password'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
            <p className="text-sm font-medium mb-1">Payment Method</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <span className="text-muted-foreground">💵 Cash on Delivery (COD)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="razorpay"
                  checked={paymentMethod === 'razorpay'}
                  onChange={() => setPaymentMethod('razorpay')}
                />
                <span className="text-muted-foreground">💳 Online payment (Razorpay)</span>
              </label>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="w-full h-12 sm:h-11 text-sm sm:text-base font-semibold"
            disabled={
              submitting || !deliveryValid || (otpRequired && !otpVerified) || !shippingGateReady || !healthShippingLoaded
            }
            onClick={() => void handlePlaceOrder()}
          >
            {submitting
              ? 'Placing order…'
              : !healthShippingLoaded
                ? 'Loading checkout…'
                : !deliveryPinValid
                  ? 'Enter 6-digit pincode'
                  : allowRelaxedShipping === true
                    ? `Place Order — ₹${payableGrandTotal}`
                    : shippingQuoteLoading
                      ? 'Checking delivery estimate…'
                      : isShippingServiceabilityError(shippingQuote)
                        ? shippingQuote.reason === 'not_serviceable'
                          ? 'Delivery not available'
                          : 'Shipping unavailable'
                        : !shippingGateReady
                          ? 'Waiting for delivery estimate…'
                          : `Place Order — ₹${payableGrandTotal}`}
          </Button>
          {deliveryValid && deliveryPinValid && healthShippingLoaded && !shippingGateReady && !submitting && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {shippingQuoteLoading
                ? 'Checking delivery estimate…'
                : isShippingServiceabilityError(shippingQuote)
                  ? shippingQuote.reason === 'not_serviceable'
                    ? 'We cannot deliver to this pincode. Try a different address.'
                    : 'Could not load delivery estimate. Check the pincode or try again shortly.'
                  : 'Confirming delivery timeline…'}
            </p>
          )}
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
                <span className="shrink-0">₹{unitPriceForItem(i, paymentMethod) * i.quantity}</span>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{checkoutMerchandise.subtotal}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Discount {couponCode ? `(${couponCode})` : ''}</span>
                  <span>-₹{discount}</span>
                </div>
              )}
              <div className="pt-2">
                <div className="flex gap-2">
                  <Input
                    value={couponDraft}
                    onChange={e => setCouponDraft(e.target.value.toUpperCase())}
                    placeholder="Coupon code"
                    className="h-10 text-sm"
                    disabled={couponBusy}
                  />
                  <Button type="button" variant="outline" className="h-10 px-4" onClick={() => void applyCheckoutCoupon()} disabled={couponBusy}>
                    {couponBusy ? 'Applying…' : 'Apply'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Coupons are validated automatically for the items in your cart.
                </p>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>
                  Shipping {shippingQuoteLoading ? '(checking…)' : ''}
                </span>
                <span>
                  {shippingQuoteLoading
                    ? '…'
                    : shippingQuote?.ok
                      ? 'Free'
                      : allowRelaxedShipping === true
                        ? '—'
                        : isShippingServiceabilityError(shippingQuote) && shippingQuote.reason === 'not_serviceable'
                          ? 'N/A'
                          : '—'}
                </span>
              </div>
              {shippingQuote?.ok && (shippingQuote.estimatedDeliveryDays != null || shippingQuote.estimatedDeliveryDate) && (
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Estimated delivery</span>
                  <span>
                    {shippingQuote.estimatedDeliveryDays != null
                      ? `${shippingQuote.estimatedDeliveryDays} day(s)`
                      : shippingQuote.estimatedDeliveryDate
                        ? new Date(shippingQuote.estimatedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                  </span>
                </div>
              )}
              {allowRelaxedShipping === true && !shippingQuoteHasEta && deliveryPinValid && (
                <p className="text-[11px] text-amber-900 dark:text-amber-200/90 leading-snug col-span-full">
                  Delivery estimate is still loading. You can continue once it’s available.
                </p>
              )}
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Items after discount</span>
                <span>₹{checkoutMerchandise.total}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t">
                <span>Total payable</span>
                <span className="tabular-nums">
                  {!healthShippingLoaded
                    ? '…'
                    : !deliveryPinValid
                      ? '—'
                      : shippingQuoteLoading && allowRelaxedShipping !== true
                        ? 'Calculating…'
                        : shippingGateReady
                          ? `₹${payableGrandTotal}`
                          : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Street / area</label>
              <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Address" className="h-10" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</label>
                <Input value={editCity} onChange={e => setEditCity(e.target.value)} className="h-10" />
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
              <Input value={editState} onChange={e => setEditState(e.target.value)} className="h-10" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={editDefault} onCheckedChange={v => setEditDefault(v === true)} />
              Set as default address
            </label>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            {!editingId ? (
              <Button type="button" className="w-full sm:w-auto" disabled={editBusy} onClick={() => void saveEditAddress(false)}>
                {editBusy ? 'Saving…' : 'Save address'}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={editBusy}
                  onClick={() => void saveEditAddress(true)}
                >
                  Save as new address
                </Button>
                <Button type="button" disabled={editBusy} onClick={() => void saveEditAddress(false)}>
                  {editBusy ? 'Saving…' : 'Update this address'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
