import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentMethod } from "@/contexts/PaymentMethodContext";
import { productImageForVariant } from "@/lib/productImages";
import { validateCouponApi } from "@/lib/couponsApi";
import { productImageAlt } from "@/lib/seo";
import { toast } from "sonner";
import type { CartItem } from "@/types";

const Icon = ({ children, className = "", size = 18 }: { children: React.ReactNode; className?: string; size?: number }) => (
  <span
    className={`inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size, fontSize: size, lineHeight: 1 }}
    aria-hidden
  >
    {children}
  </span>
);

const icons = {
  trash: "🗑",
  shield: "🛡️",
  truck: "🚚",
  coupon: "🏷️",
  lock: "🔒",
  plus: "+",
  minus: "−",
  arrow: "→",
  bag: "🛍️",
} as const;

function QuantityControl({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onDecrease}
        className="grid h-11 w-12 place-items-center text-xl font-black text-slate-700 transition hover:bg-orange-50 hover:text-orange-600"
        aria-label="Decrease quantity"
      >
        {icons.minus}
      </button>
      <div className="grid h-11 min-w-12 place-items-center border-x border-slate-200 px-4 text-sm font-black text-slate-900">
        {quantity}
      </div>
      <button
        type="button"
        onClick={onIncrease}
        className="grid h-11 w-12 place-items-center text-xl font-black text-slate-700 transition hover:bg-orange-50 hover:text-orange-600"
        aria-label="Increase quantity"
      >
        {icons.plus}
      </button>
    </div>
  );
}

function CartItemCard({
  item,
  image,
  unitPrice,
  oldUnitPrice,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem;
  image: string;
  unitPrice: number;
  oldUnitPrice?: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const size = item.selectedSize || "";
  const color = item.selectedVariant || "";
  const sleeve = item.selectedSleeve || "";

  const showOld = typeof oldUnitPrice === "number" && oldUnitPrice > unitPrice;

  return (
    <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100 sm:w-40 md:w-44">
          <img
            src={image}
            alt={productImageAlt(item.product, "cart item image")}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <span className="absolute left-3 top-3 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-bold text-white">
            In Cart
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="line-clamp-2 text-lg font-black text-slate-950 md:text-xl">{item.product.name}</h3>
              <p className="mt-2 text-sm text-slate-500">
                {size && (
                  <>
                    Size: <span className="font-bold text-slate-700">{size}</span>
                    <span className="mx-2 text-slate-300">•</span>
                  </>
                )}
                {color ? (
                  <>
                    Color: <span className="font-bold text-slate-700">{color}</span>
                  </>
                ) : (
                  <span className="font-bold text-slate-700">Default</span>
                )}
                {sleeve ? (
                  <>
                    <span className="mx-2 text-slate-300">•</span>
                    {sleeve}
                  </>
                ) : null}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-orange-50 px-3 py-1 font-bold text-orange-600">Free delivery</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 font-bold text-slate-600">Secure checkout</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onRemove}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Remove item"
            >
              <Icon size={18}>{icons.trash}</Icon>
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <QuantityControl quantity={item.quantity} onDecrease={onDecrease} onIncrease={onIncrease} />

            <div className="text-left sm:text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Item Total</p>
              <div className="mt-1 flex items-end gap-2 sm:justify-end">
                <p className="text-2xl font-black text-slate-950">₹{unitPrice * item.quantity}</p>
                {showOld ? <p className="pb-1 text-sm text-slate-400 line-through">₹{oldUnitPrice! * item.quantity}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceModeBox({
  method,
  onChange,
}: {
  method: "cod" | "razorpay";
  onChange: (m: "cod" | "razorpay") => void;
}) {
  return (
    <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-orange-600 shadow-sm">
            <Icon size={20}>{icons.shield}</Icon>
          </div>
          <div>
            <h2 className="font-black text-slate-950">Price mode</h2>
            <p className="mt-1 text-sm text-slate-500">Choose COD or online payment.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
          <button
            type="button"
            onClick={() => onChange("cod")}
            className={`rounded-xl px-6 py-3 text-sm font-black transition ${
              method === "cod" ? "bg-orange-600 text-white shadow-md shadow-orange-600/20" : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
            }`}
          >
            COD
          </button>
          <button
            type="button"
            onClick={() => onChange("razorpay")}
            className={`rounded-xl px-6 py-3 text-sm font-black transition ${
              method === "razorpay" ? "bg-orange-600 text-white shadow-md shadow-orange-600/20" : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
            }`}
          >
            Online
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-white p-10 text-center shadow-sm">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white text-4xl shadow-lg shadow-orange-100">
        {icons.bag}
      </div>
      <h2 className="mt-5 text-2xl font-black text-slate-950">Your cart is empty</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Looks like you haven’t added anything yet. Explore trending products and start shopping.
      </p>
      <Link to="/" className="mt-6 inline-block">
        <button
          type="button"
          className="rounded-2xl bg-orange-600 px-7 py-3 text-sm font-black text-white shadow-lg shadow-orange-600/20"
        >
          Continue Shopping
        </button>
      </Link>
    </div>
  );
}

export default function CartPage() {
  const {
    items,
    removeItem,
    updateQuantity,
    couponCode,
    couponValidatedFor,
    applyCoupon,
    clearCoupon,
    unitPriceForItem,
    totalsForPaymentMethod,
  } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { method: paymentMethod, setMethod: setPaymentMethod } = usePaymentMethod();

  const [code, setCode] = useState("");
  const [couponLoginPrompt, setCouponLoginPrompt] = useState(false);
  const couponRecheckBusyRef = useRef(false);

  const originalUnitPriceForItem = (item: CartItem): number | null => {
    const productAny = item.product as any;
    if (productAny?.variantModel?.items?.length && item.selectedVariant) {
      const key = String(item.selectedVariant);
      const variantHit = productAny.variantModel.items.find((x: any) => String(x?.key) === key);
      const variantOriginal = Number(variantHit?.originalPrice);
      if (Number.isFinite(variantOriginal) && variantOriginal > 0) return variantOriginal;
    }
    const productOriginal = Number(productAny?.originalPrice);
    return Number.isFinite(productOriginal) && productOriginal > 0 ? productOriginal : null;
  };

  const computed = totalsForPaymentMethod(paymentMethod);
  const subtotal = computed.subtotal;
  const total = computed.total;
  const couponSavings = computed.discount;
  const productSavings = items.reduce((sum, item) => {
    const currentUnit = unitPriceForItem(item, paymentMethod);
    const originalUnit = originalUnitPriceForItem(item);
    if (!originalUnit || originalUnit <= currentUnit) return sum;
    return sum + (originalUnit - currentUnit) * item.quantity;
  }, 0);
  const savings = productSavings + couponSavings;
  const paymentLabel = paymentMethod === "razorpay" ? "online payment" : "COD";
  const couponDiscountLabel =
    !couponCode
      ? "No coupon applied"
      : couponSavings > 0
        ? `-₹${couponSavings}`
        : `Not valid on ${paymentLabel}`;

  const handleCoupon = async () => {
    if (!user && !authLoading) {
      setCouponLoginPrompt(true);
      return;
    }

    const trimmed = code.trim();
    if (!trimmed) {
      toast.error("Enter coupon code");
      return;
    }

    setCouponLoginPrompt(false);
    try {
      const r = await validateCouponApi({
        code: trimmed,
        subtotal,
        paymentMethod,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, selectedVariant: i.selectedVariant })),
      });
      applyCoupon(r.couponCode, r.discount, { paymentMethodScope: r.paymentMethodScope, validatedFor: paymentMethod });
      setCode(r.couponCode);
      toast.success(`Coupon applied! You save ₹${r.discount}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid or expired coupon");
    }
  };

  useEffect(() => {
    if (user) setCouponLoginPrompt(false);
  }, [user]);

  useEffect(() => {
    if (!couponCode || couponValidatedFor === paymentMethod) return;
    if (couponRecheckBusyRef.current) return;
    couponRecheckBusyRef.current = true;
    const currentSubtotal = totalsForPaymentMethod(paymentMethod).subtotal;

    void (async () => {
      try {
        const r = await validateCouponApi({
          code: couponCode,
          subtotal: currentSubtotal,
          paymentMethod,
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, selectedVariant: i.selectedVariant })),
        });
        applyCoupon(r.couponCode, r.discount, { paymentMethodScope: r.paymentMethodScope, validatedFor: paymentMethod });
      } catch (e) {
        clearCoupon();
        toast.error(e instanceof Error ? e.message : `This coupon is not valid for ${paymentLabel}.`);
      } finally {
        couponRecheckBusyRef.current = false;
      }
    })();
  }, [applyCoupon, clearCoupon, couponCode, couponValidatedFor, items, paymentLabel, paymentMethod, totalsForPaymentMethod]);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  if (!items.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight text-slate-950">Cart</h1>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">
            <Icon size={15}>{icons.bag}</Icon> {cartCount} item{cartCount === 1 ? "" : "s"}
          </span>
        </div>

        <EmptyCart />

        <div className="mt-4 text-center text-sm text-slate-500">
          Items in cart: <span className="font-bold">{cartCount}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Cart</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">
            <Icon size={15}>{icons.bag}</Icon> {cartCount} item{cartCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
            <Icon size={15}>{icons.truck}</Icon> Free Delivery
          </span>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_390px]">
        <div className="space-y-5">
          <PriceModeBox method={paymentMethod} onChange={setPaymentMethod} />

          <div className="space-y-4">
            {items.map((item) => {
              const image = productImageForVariant(item.product, item.selectedVariant);
              const unitPrice = unitPriceForItem(item, paymentMethod);
              const oldUnitPrice = originalUnitPriceForItem(item) ?? undefined;

              return (
                <CartItemCard
                  key={item.cartLineId}
                  item={item}
                  image={image}
                  unitPrice={unitPrice}
                  oldUnitPrice={oldUnitPrice}
                  onIncrease={() => updateQuantity(item.cartLineId, item.quantity + 1)}
                  onDecrease={() => updateQuantity(item.cartLineId, item.quantity - 1)}
                  onRemove={() => removeItem(item.cartLineId)}
                />
              );
            })}
          </div>
        </div>

        <aside className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-xl shadow-orange-100/70 lg:sticky lg:top-24">
          <div className="bg-gradient-to-br from-orange-50 via-white to-orange-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-orange-600">Checkout</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Order Summary</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-orange-600 shadow-sm">Secure</span>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-black text-slate-950">₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Delivery</span>
                <span className="font-black text-orange-600">Free</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Coupon discount</span>
                <span className={couponSavings > 0 ? "font-black text-emerald-700" : "font-semibold text-slate-400"}>
                  {couponDiscountLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">You saved</span>
                <span className="font-black text-emerald-600">₹{savings}</span>
              </div>
            </div>

            <div className="my-5 border-t border-dashed border-slate-200" />

            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
              <span className="text-lg font-black text-slate-950">Total</span>
              <span className="text-3xl font-black text-slate-950">₹{total}</span>
            </div>

            <div className="mt-6 rounded-2xl bg-orange-50 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-orange-700">
                <Icon size={17}>{icons.coupon}</Icon> Apply coupon
              </div>

              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-400"
                  placeholder="Coupon code"
                />
                <button
                  type="button"
                  onClick={() => void handleCoupon()}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:bg-orange-600 hover:text-white"
                >
                  Apply
                </button>
              </div>
              {couponLoginPrompt && !user ? (
                <div className="mt-3 rounded-xl border border-orange-200 bg-white p-3">
                  <p className="text-xs font-semibold text-orange-700">
                    Coupon can be applied only when you are logged in.
                  </p>
                  <Link to="/login" className="mt-2 inline-block">
                    <button
                      type="button"
                      className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-700"
                    >
                      Go to Login
                    </button>
                  </Link>
                </div>
              ) : null}

              {couponCode ? (
                <p className="mt-2 text-xs text-slate-600">
                  Applied: <span className="font-bold">{couponCode}</span>{couponSavings > 0 ? "" : ` (not applicable on ${paymentLabel})`}
                </p>
              ) : null}
            </div>

            <Link to="/checkout" className="mt-5 block">
              <button className="w-full mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-orange-600/25 transition hover:bg-orange-700 active:scale-[0.98]" type="button">
                Proceed to Checkout <Icon size={17}>{icons.arrow}</Icon>
              </button>
            </Link>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3">
                <Icon size={18}>{icons.lock}</Icon>
                <span>Secure checkout</span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3">
                <Icon size={18}>{icons.truck}</Icon>
                <span>Free delivery</span>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
