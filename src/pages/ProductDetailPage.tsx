import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProducts } from '@/contexts/ProductsContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import ProductImageGallery from '@/components/ProductImageGallery';
import RatingSummaryInline from '@/components/reviews/RatingSummaryInline';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, ArrowLeft, Minus, Plus, Check, ChevronDown, ChevronUp, Truck, ShieldCheck, BadgeCheck, Package } from 'lucide-react';
import type { CartItem, Product } from '@/types';
import { productVariantNames } from '@/lib/productVariants';
import { galleryImagesForSelection } from '@/lib/productImages';
import { fetchProductReviewsApi, type Review as ApiReview } from '@/lib/reviewsApi';
import { fetchProductByIdApi } from '@/lib/api';
import { parseProductSpecifications } from '@/lib/productSpecifications';
import { usePaymentMethod } from '@/contexts/PaymentMethodContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchShippingServiceabilityApi, isShippingServiceabilityError, type ShippingServiceabilityResult } from '@/lib/shippingApi';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet-async';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import { RichTextRenderer } from '@/components/RichTextRenderer';

const CANONICAL_BASE = 'https://trendnest99.in';

function productJsonLd(args: {
  url: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  inStock: boolean;
  ratingValue?: number;
  reviewCount?: number;
  category?: string;
}) {
  const {
    url,
    name,
    description,
    images,
    price,
    inStock,
    ratingValue,
    reviewCount,
    category,
  } = args;

  const product: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: images,
    brand: { '@type': 'Brand', name: 'TrendNest99' },
    category: category || undefined,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: Number.isFinite(price) ? String(price) : undefined,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  if (ratingValue && reviewCount && reviewCount > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(ratingValue).toFixed(1),
      reviewCount: String(reviewCount),
    };
  }

  return product;
}

function breadcrumbJsonLd(args: { url: string; categoryId?: string; categoryName?: string; productName: string }) {
  const { url, categoryId, categoryName, productName } = args;
  const itemListElement: any[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_BASE}/` },
  ];
  if (categoryId && categoryName) {
    itemListElement.push({
      '@type': 'ListItem',
      position: 2,
      name: categoryName,
      item: `${CANONICAL_BASE}/category/${encodeURIComponent(categoryId)}`,
    });
    itemListElement.push({
      '@type': 'ListItem',
      position: 3,
      name: productName,
      item: url,
    });
  } else {
    itemListElement.push({
      '@type': 'ListItem',
      position: 2,
      name: productName,
      item: url,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

function normKey(s: string) { return String(s ?? '').trim().toLowerCase(); }
function normVal(s: string) { return String(s ?? '').trim().toLowerCase(); }

function getAttrValueCaseInsensitive(attrs: Record<string, string> | undefined, typeName: string): string {
  if (!attrs) return '';
  const nk = normKey(typeName);
  if (Object.prototype.hasOwnProperty.call(attrs, typeName) && attrs[typeName] != null) return String(attrs[typeName]);
  const key = Object.keys(attrs).find(k => normKey(k) === nk);
  return key ? String(attrs[key] ?? '') : '';
}

function dedupeImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter(u => { const s = String(u).trim(); if (!s || seen.has(s)) return false; seen.add(s); return true; });
}

function variantOptionLabel(product: Product): string {
  if (product.subcategory === 'Belts') return 'Leather color';
  if (product.category === 'home') return 'Finish';
  return 'Color';
}

const pillBtn = (active: boolean) =>
  `rounded-xl px-4 py-2 text-sm font-medium border-2 transition-all duration-200 ${
    active
      ? 'bg-primary/10 text-primary border-primary shadow-sm'
      : 'bg-background text-foreground/70 border-border hover:border-foreground/30 hover:text-foreground'
  }`;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, ratingSummary, loading } = useProducts();
  const showSkeleton = useDelayedFlag(loading, 250);
  const { method: paymentMethod, setMethod: setPaymentMethod } = usePaymentMethod();
  const fromList = id ? products.find(p => p.id === id) : undefined;
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = () => { void (async () => { const one = await fetchProductByIdApi(id); if (!cancelled && one) setFetchedProduct(one); })(); };
    load();
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    const onProductsUpdated = () => { load(); };
    window.addEventListener('trendnest:products-updated', onProductsUpdated);
    const onProductUpdated = (e: Event) => { const ce = e as CustomEvent<{ id?: string }>; if (ce.detail?.id === id) load(); };
    window.addEventListener('trendnest:product-updated', onProductUpdated);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('trendnest:products-updated', onProductsUpdated);
      window.removeEventListener('trendnest:product-updated', onProductUpdated);
    };
  }, [id]);

  // Prefer the latest list copy for stock; fall back to fetched detail.
  const product = fromList ?? fetchedProduct;
  const seoTitle = product?.name ? `${product.name} | TrendNest99` : 'Product | TrendNest99';
  const seoDesc = product?.description
    ? String(product.description).slice(0, 160)
    : 'Shop products on TrendNest99.';
  const canonicalUrl = id ? `${CANONICAL_BASE}/product/${encodeURIComponent(id)}` : `${CANONICAL_BASE}/`;
  const ogImage = product?.images?.[0] ? String(product.images[0]) : undefined;
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedVariantKey, setSelectedVariantKey] = useState('');
  const [variantAttrs, setVariantAttrs] = useState<Record<string, string>>({});
  const [selectedSleeve, setSelectedSleeve] = useState('');
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [reviewsCursor, setReviewsCursor] = useState<string | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [pincode, setPincode] = useState('');
  const [shippingQuote, setShippingQuote] = useState<ShippingServiceabilityResult | null>(null);
  const [shippingBusy, setShippingBusy] = useState(false);

  const hasVariantModel = !!(product?.variantModel?.items?.length);

  // ... rest of component

  const selectedVariantItem = useMemo(() => {
    if (!product?.variantModel?.items?.length) return null;
    const items = product.variantModel.items;
    if (selectedVariantKey) {
      const k = String(selectedVariantKey);
      const hit = items.find(x => String(x.key) === k);
      if (hit) return hit;
    }
    return items[0] ?? null;
  }, [product, selectedVariantKey]);

  const pdpGoodsLineTotal = useMemo(() => {
    if (!product) return 0;
    const hasVM = !!(product.variantModel?.items?.length);
    const basePrice = hasVM && selectedVariantItem ? Number(selectedVariantItem.price) : Number(product.price);
    const codP =
      hasVM && selectedVariantItem && selectedVariantItem.codPrice != null
        ? Number(selectedVariantItem.codPrice)
        : product.codPrice != null
          ? Number(product.codPrice)
          : basePrice;
    const onlP =
      hasVM && selectedVariantItem && selectedVariantItem.onlinePrice != null
        ? Number(selectedVariantItem.onlinePrice)
        : product.onlinePrice != null
          ? Number(product.onlinePrice)
          : codP;
    const unit = paymentMethod === 'razorpay' ? onlP : codP;
    const u = Number.isFinite(unit) ? unit : 0;
    const q = Math.max(1, Math.floor(Number(qty)) || 1);
    return Math.max(0, u * q);
  }, [product, selectedVariantItem, paymentMethod, qty]);

  useEffect(() => {
    if (!product) return;
    setSelectedSize(product.sizes?.[0] || '');
    if (product.variantModel?.items?.length) {
      const items = product.variantModel.items;
      const first = items.find(x => x.isDefault) ?? items[0];
      setSelectedVariantKey(first.key);
      setVariantAttrs({ ...(first.attrs ?? {}) });
      setSelectedVariant('');
    } else {
      setSelectedVariant(productVariantNames(product)[0] || '');
      setSelectedVariantKey('');
      setVariantAttrs({});
    }
    setSelectedSleeve(product.sleeveTypes?.[0] || '');
    setQty(1);
  }, [product]);

  useEffect(() => {
    const pin = pincode.replace(/[^\d]/g, '').slice(0, 6);
    if (pin.length !== 6 || !product?.id) {
      setShippingQuote(null);
      return;
    }
    const hasVM = !!(product.variantModel?.items?.length);
    const lineQty = Math.max(1, Math.floor(Number(qty)) || 1);
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setShippingBusy(true);
        try {
          const q = await fetchShippingServiceabilityApi({
            pincode: pin,
            items: [
              {
                cartLineId: 'pdp',
                product,
                quantity: lineQty,
                selectedSize: selectedSize || product.sizes?.[0],
                selectedVariant: hasVM ? selectedVariantKey : selectedVariant,
                selectedSleeve: selectedSleeve || product.sleeveTypes?.[0],
              } as CartItem,
            ],
            paymentMethod: paymentMethod === 'razorpay' ? 'razorpay' : 'cod',
            goodsAfterDiscount: pdpGoodsLineTotal,
          });
          if (!cancelled) setShippingQuote(q);
        } finally {
          if (!cancelled) setShippingBusy(false);
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    pincode,
    product,
    paymentMethod,
    pdpGoodsLineTotal,
    qty,
    selectedSize,
    selectedVariant,
    selectedVariantKey,
    selectedSleeve,
  ]);

  useEffect(() => {
    if (!product?.id) return;
    let mounted = true;
    setReviewsLoading(true);
    void (async () => {
      try { const r = await fetchProductReviewsApi({ productId: product.id, limit: 5 }); if (!mounted) return; setReviews(r.reviews); setReviewsCursor(r.nextCursor); }
      finally { if (mounted) setReviewsLoading(false); }
    })();
    return () => { mounted = false; };
  }, [product?.id]);

  const loadMoreReviews = async () => {
    if (!product?.id || !reviewsCursor || reviewsLoading) return;
    setReviewsLoading(true);
    try { const r = await fetchProductReviewsApi({ productId: product.id, limit: 10, cursor: reviewsCursor }); setReviews(prev => [...prev, ...r.reviews]); setReviewsCursor(r.nextCursor); }
    finally { setReviewsLoading(false); }
  };

  const variantNames = product ? productVariantNames(product) : [];
  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (hasVariantModel && selectedVariantItem) {
      const variantImages = (Array.isArray(selectedVariantItem.images) ? selectedVariantItem.images : []).map((u: unknown) => String(u).trim()).filter(Boolean);
      const legacyImg = selectedVariantItem.image ? String(selectedVariantItem.image).trim() : '';
      const rootOnly = dedupeImageUrls((product.images ?? []).map(u => String(u).trim()).filter(Boolean));
      if (variantImages.length === 0 && !legacyImg) return rootOnly;
      const primaryList = variantImages.length > 0 ? variantImages : legacyImg ? [legacyImg] : [];
      // Only that variant’s photos — do not append `product.images` or other colors appear when swiping.
      return dedupeImageUrls(primaryList);
    }
    return galleryImagesForSelection(product, selectedVariant);
  }, [product, selectedVariant, hasVariantModel, selectedVariantItem]);

  const specRows = useMemo(() => {
    if (!product) return [];
    return parseProductSpecifications(fetchedProduct ?? product);
  }, [product, fetchedProduct]);

  const related = useMemo(() => {
    if (!product?.id) return [];
    return (products ?? [])
      .filter(p => p.id !== product.id)
      .filter(p => (p.category || '') === (product.category || ''))
      .slice(0, 5);
  }, [products, product?.id, product?.category]);

  if (!product && showSkeleton) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pb-28 md:pb-8 pt-4 sm:pt-6">
        <div className="h-4 w-20 bg-muted rounded-md animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 md:items-start">
          <div className="aspect-square rounded-2xl overflow-hidden border bg-card">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center animate-fade-in">
        <p className="text-muted-foreground">Product not found.</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">Go Home</Link>
      </div>
    );
  }

  const basePrice = hasVariantModel && selectedVariantItem ? Number(selectedVariantItem.price) : Number(product.price);
  const codPrice = hasVariantModel && selectedVariantItem && selectedVariantItem.codPrice != null
    ? Number(selectedVariantItem.codPrice)
    : product.codPrice != null ? Number(product.codPrice) : basePrice;
  const onlinePrice = hasVariantModel && selectedVariantItem && selectedVariantItem.onlinePrice != null
    ? Number(selectedVariantItem.onlinePrice)
    : product.onlinePrice != null ? Number(product.onlinePrice) : codPrice;
  const selectedPrice = paymentMethod === 'razorpay' ? onlinePrice : codPrice;
  const mrp = hasVariantModel && selectedVariantItem && selectedVariantItem.originalPrice != null
    ? Number(selectedVariantItem.originalPrice)
    : product.originalPrice != null ? Number(product.originalPrice) : null;
  const discount = mrp && Number.isFinite(mrp) && mrp > 0 && Number.isFinite(selectedPrice) && selectedPrice > 0
    ? Math.round(((mrp - selectedPrice) / mrp) * 100) : 0;
  const stock = (hasVariantModel && selectedVariantItem) ? selectedVariantItem.stock : product.stock;
  const inStock = stock > 0;
  const stockMessage = !inStock ? 'Out of Stock' : stock <= 5 ? 'Few items left' : 'In Stock';

  const summary = ratingSummary[product.id];
  const avg = summary?.avgRating ?? 0;
  const count = summary?.reviewCount ?? 0;

  const handleAddToCart = () => addItem({
    product, quantity: qty,
    selectedSize: product.sizes?.length ? selectedSize : undefined,
    selectedVariant: hasVariantModel ? (selectedVariantItem?.key ?? undefined) : variantNames.length ? selectedVariant : undefined,
    selectedSleeve: product.sleeveTypes?.length ? selectedSleeve : undefined,
  });

  const handleBuyNow = () => {
    if (!inStock) return;
    handleAddToCart();
    navigate('/checkout');
  };

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta property="og:url" content={canonicalUrl} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <script type="application/ld+json">
          {JSON.stringify(
            productJsonLd({
              url: canonicalUrl,
              name: product.name,
              description: String(product.description || '').trim() || seoDesc,
              images: Array.isArray(product.images) ? product.images.map((u) => String(u)).filter(Boolean) : [],
              price: Number.isFinite(selectedPrice) ? selectedPrice : Number(product.price) || 0,
              inStock,
              ratingValue: avg || undefined,
              reviewCount: count || undefined,
              category: product.category,
            })
          )}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(
            breadcrumbJsonLd({
              url: canonicalUrl,
              categoryId: product.category,
              categoryName: product.category === 'home' ? 'Home Essentials' : product.category === 'fashion' ? 'Fashion' : product.category === 'trending' ? 'Trending' : product.category,
              productName: product.name,
            })
          )}
        </script>
      </Helmet>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pb-28 md:pb-8 pt-4 sm:pt-6 animate-fade-in">
        {/* Back link */}
        <Link
          to={product.category === 'fashion' ? '/#fashion-picks' : `/category/${product.category}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 md:items-start">
          {/* Image gallery */}
          <ProductImageGallery
            productId={product.id}
            images={galleryImages}
            productName={product.name}
            outOfStock={!inStock}
            resetKey={hasVariantModel ? selectedVariantKey : selectedVariant}
          />

          {/* Product info */}
          <div className="space-y-5">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              {product.isTrending && (
                <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                  🔥 Trending
                </span>
              )}
              {inStock ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <Check className="h-3 w-3" /> In Stock
                </span>
              ) : (
                <span className="text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">Out of Stock</span>
              )}
            </div>

            {/* Delivery check */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="h-4 w-4 text-primary" />
                Check delivery
              </div>
              <div className="flex gap-2">
                <Input
                  value={pincode}
                  onChange={e => setPincode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  placeholder="Enter pincode"
                  className="h-10"
                  inputMode="numeric"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {shippingBusy
                  ? 'Checking serviceability…'
                  : shippingQuote?.ok
                    ? `Free shipping${
                        shippingQuote.estimatedDeliveryDays != null ? ` · ETA ${shippingQuote.estimatedDeliveryDays} day(s)` : ''
                      }`
                    : isShippingServiceabilityError(shippingQuote) && shippingQuote.reason === 'not_serviceable'
                      ? 'Not serviceable for this pincode'
                      : pincode.replace(/[^\d]/g, '').length === 6
                        ? 'Shipping info currently unavailable'
                        : 'Enter your pincode to see charges and ETA'}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight leading-tight text-foreground">
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center">
              <RatingSummaryInline
                avgRating={avg}
                reviewCount={count}
                onClick={
                  count > 0
                    ? () => document.getElementById('customer-reviews')?.scrollIntoView({ behavior: 'smooth' })
                    : undefined
                }
                starClassName="text-base leading-none"
                textClassName="text-sm text-muted-foreground group-hover:text-foreground transition-colors"
                className={count > 0 ? 'group' : undefined}
              />
            </div>

            {/* Price block */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums">₹{selectedPrice}</span>
                {mrp != null && mrp > 0 && mrp !== selectedPrice && (
                  <span className="text-base text-muted-foreground line-through tabular-nums mb-0.5">MRP ₹{mrp}</span>
                )}
                {discount > 0 && (
                  <span className="bg-primary/15 text-primary text-xs font-bold px-2.5 py-1 rounded-lg mb-0.5">
                    {discount}% OFF
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>

              {/* Payment method toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  disabled={!inStock}
                  className={`flex-1 text-center text-sm py-2.5 rounded-xl border-2 font-medium transition-all duration-200 ${
                    paymentMethod === 'cod'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/20'
                  }`}
                >
                  COD · ₹{codPrice}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  disabled={!inStock}
                  className={`flex-1 text-center text-sm py-2.5 rounded-xl border-2 font-medium transition-all duration-200 ${
                    paymentMethod === 'razorpay'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-foreground/20'
                  }`}
                >
                  Online · ₹{onlinePrice}
                </button>
              </div>
            </div>

            {/* Size selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Size</p>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map(s => (
                    <button key={s} type="button" onClick={() => setSelectedSize(s)} className={pillBtn(selectedSize === s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Sleeve selector */}
            {product.sleeveTypes && product.sleeveTypes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Sleeve</p>
                <div className="flex gap-2 flex-wrap">
                  {product.sleeveTypes.map(s => (
                    <button key={s} type="button" onClick={() => setSelectedSleeve(s)} className={pillBtn(selectedSleeve === s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Variant model selectors */}
            {hasVariantModel && product.variantModel ? (
              <div className="space-y-3">
                {product.variantModel.types.map(t => (
                  <div key={t.name} className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <div className="flex gap-2 flex-wrap">
                      {t.values.map(v => {
                        const active = normVal(String(variantAttrs[t.name] ?? '')) === normVal(String(v));
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              const next = { ...variantAttrs, [t.name]: v };
                              setVariantAttrs(next);
                              const types = product.variantModel!.types;
                              const items = product.variantModel!.items;
                              const hit = items.find(x => {
                                const attrs = (x as { attrs?: Record<string, string> }).attrs;
                                return types.every(ty => normVal(getAttrValueCaseInsensitive(attrs, ty.name)) === normVal(String(next[ty.name] ?? '').trim()));
                              }) ?? null;
                              if (hit) { setSelectedVariantKey(hit.key); }
                              else { const first = items[0]; if (first) { setSelectedVariantKey(first.key); setVariantAttrs({ ...(first.attrs ?? {}) }); } }
                            }}
                            className={pillBtn(active)}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : variantNames.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{variantOptionLabel(product)}</p>
                <div className="flex gap-2 flex-wrap">
                  {variantNames.map(v => (
                    <button key={v} type="button" onClick={() => setSelectedVariant(v)} className={pillBtn(selectedVariant === v)}>{v}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom print CTA */}
            {product.isCustomPrint && (
              <Link to="/custom-print" className="block">
                <Button variant="outline" className="w-full rounded-xl h-11">🎨 Upload Custom Design →</Button>
              </Link>
            )}

            {/* Quantity + Add to Cart – desktop only (mobile uses sticky bar) */}
            <div className="hidden md:flex items-stretch gap-3">
              <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-border bg-background text-sm font-medium">
                <button type="button" className="px-3.5 py-3 hover:bg-muted/80 active:bg-muted" onClick={() => setQty(Math.max(1, qty - 1))}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="flex min-w-[2.5rem] items-center justify-center border-x border-border tabular-nums">{qty}</span>
                <button type="button" className="px-3.5 py-3 hover:bg-muted/80 active:bg-muted" onClick={() => setQty(qty + 1)}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button
                size="lg"
                variant="secondary"
                className="flex-1 gap-2 rounded-xl text-base font-semibold h-12"
                onClick={handleBuyNow}
                disabled={!inStock}
              >
                Buy Now
              </Button>
              <Button
                size="lg"
                className="flex-1 gap-2 rounded-xl text-base font-semibold h-12"
                onClick={handleAddToCart}
                disabled={!inStock}
              >
                <ShoppingCart className="h-5 w-5" /> Add to Cart
              </Button>
            </div>

            {/* Stock info (no exact quantities on storefront) */}
            <p className="text-xs hidden md:block">
              <span
                className={
                  inStock
                    ? stock <= 5
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                    : 'text-destructive'
                }
              >
                {stockMessage}
              </span>
            </p>

          </div>
        </div>

        {/* Rich layout: tabs + highlights + related (responsive on all viewports) */}
        <div className="mt-8 sm:mt-10 space-y-6 sm:space-y-8">
          {/* Tabs row */}
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-5">
            <Tabs defaultValue="description">
              <TabsList className="w-full justify-start overflow-x-auto scrollbar-none flex-nowrap">
                <TabsTrigger value="description" className="text-xs sm:text-sm whitespace-nowrap">Description</TabsTrigger>
                <TabsTrigger value="specs" className="text-xs sm:text-sm whitespace-nowrap">Specifications</TabsTrigger>
                <TabsTrigger value="shipping" className="text-xs sm:text-sm whitespace-nowrap">Shipping &amp; Returns</TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-4">
                {product.description ? (
                  <RichTextRenderer value={product.description} className="text-sm text-muted-foreground leading-relaxed" />
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">No description provided.</p>
                )}
              </TabsContent>
              <TabsContent value="specs" className="mt-4">
                {specRows.length > 0 ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {specRows.map((row, i) => (
                      <div key={`${row.label}-${i}`} className="flex items-start justify-between gap-4 border-b border-border/40 pb-2">
                        <dt className="text-muted-foreground font-medium">{row.label.trim()}</dt>
                        <dd className="text-foreground text-right">{row.value.trim()}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No specifications.</p>
                )}
              </TabsContent>
              <TabsContent value="shipping" className="mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <Truck className="h-4 w-4 text-primary" /> Fast delivery
                    </div>
                    <p className="mt-1 text-muted-foreground">Usually delivered within 2–5 business days (location dependent).</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Secure packaging
                    </div>
                    <p className="mt-1 text-muted-foreground">Packed safely to avoid damage during transit.</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center gap-2 font-semibold">
                      <Package className="h-4 w-4 text-primary" /> Easy returns
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Request a return from Account → My Orders after delivery (typically within 7 days; see Return Policy).
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Highlights row (keeps your theme colors) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
              <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold truncate">Quality checked</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Verified before dispatch</div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold truncate">Secure payments</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Trusted checkout</div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
              <Truck className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold truncate">Fast delivery</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Quick processing</div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 min-w-0">
              <Package className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-semibold truncate">Easy support</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">We're here to help</div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews section */}
        {(reviewsLoading || reviews.length > 0) && (
          <div id="customer-reviews" className="mt-10 scroll-mt-24">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg sm:text-xl font-bold">Customer Reviews</h2>
              {!showAllReviews && reviews.length > 5 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setShowAllReviews(true)}
                >
                  View all reviews →
                </button>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {(showAllReviews ? reviews : reviews.slice(0, 5)).map((r) => {
                const name = String(r.userName || 'User').trim() || 'User';
                const initial = name.slice(0, 1).toUpperCase();
                const created =
                  r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                const starFull = '★'.repeat(Math.max(0, Math.min(5, Math.floor(Number(r.rating) || 0))));
                const starEmpty = '☆'.repeat(Math.max(0, 5 - starFull.length));
                const palette = ['bg-violet-600', 'bg-fuchsia-600', 'bg-rose-600', 'bg-amber-600', 'bg-emerald-600', 'bg-sky-600'];
                const color = palette[(name.charCodeAt(0) + name.length) % palette.length];

                return (
                  <div key={r.id} className="px-4 py-3 border-t first:border-t-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-full ${color} text-white flex items-center justify-center text-xs font-semibold shrink-0`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                              Verified Buyer
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                            {String(r.comment || '').trim()}
                          </p>
                          {created ? <div className="text-[11px] text-muted-foreground mt-1">{created}</div> : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-yellow-500 text-sm leading-none mt-0.5">
                        {starFull}
                        <span className="text-muted-foreground/30">{starEmpty}</span>
                      </div>
                    </div>

                    {r.media?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.media.slice(0, 4).map((m, idx) => (
                          <a key={idx} href={m.url} target="_blank" rel="noreferrer" className="block">
                            {m.kind === 'video' ? (
                              <video
                                src={m.url}
                                className="h-16 w-16 rounded-xl object-cover border border-border bg-muted"
                                controls
                                muted
                              />
                            ) : (
                              <img src={m.url} alt="Review" className="h-16 w-16 rounded-xl object-cover border border-border" />
                            )}
                          </a>
                        ))}
                      </div>
                    ) : r.images?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.images.slice(0, 4).map((img, idx) => (
                          <a key={idx} href={img.url} target="_blank" rel="noreferrer">
                            <img src={img.url} alt="Review" className="h-16 w-16 rounded-xl object-cover border border-border" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {reviewsLoading ? <div className="px-4 py-3 text-sm text-muted-foreground">Loading reviews…</div> : null}
            </div>

            {reviewsCursor && (
              <div className="mt-4">
                <Button variant="outline" onClick={() => void loadMoreReviews()} disabled={reviewsLoading} className="w-full sm:w-auto rounded-xl">
                  {reviewsLoading ? 'Loading…' : 'See More Reviews'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Related products (desktop only) */}
        {related.length > 0 && (
          <div className="hidden md:block mt-12">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-lg font-bold">You May Also Like</h2>
              <Link to={`/category/${product.category}`} className="text-sm text-primary hover:underline">View more</Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {related.map(p => (
                <Link
                  key={p.id}
                  to={`/product/${encodeURIComponent(p.id)}`}
                  className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow"
                >
                  <div className="aspect-square bg-muted">
                    <img src={p.images?.[0] ?? ''} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
                    <div className="mt-1 text-sm font-bold tabular-nums">₹{p.price}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar – mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 px-3 py-2.5 max-w-6xl mx-auto">
          {/* Qty + Price stacked compactly */}
          <div className="flex flex-col gap-1 shrink-0 min-w-0">
            <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-border bg-background text-xs font-medium">
              <button type="button" className="px-2 py-1 active:bg-muted" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease quantity">
                <Minus className="h-3 w-3" />
              </button>
              <span className="flex min-w-[1.75rem] items-center justify-center border-x border-border tabular-nums text-xs">{qty}</span>
              <button type="button" className="px-2 py-1 active:bg-muted" onClick={() => setQty(qty + 1)} aria-label="Increase quantity">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums leading-none">₹{selectedPrice * qty}</span>
          </div>

          <div className="flex flex-1 gap-1.5 min-w-0">
            <Button
              variant="secondary"
              className="flex-1 min-w-0 rounded-lg h-11 px-2 text-xs font-semibold"
              onClick={handleBuyNow}
              disabled={!inStock}
            >
              Buy Now
            </Button>
            <Button
              className="flex-1 min-w-0 gap-1 rounded-lg h-11 px-2 text-xs font-semibold"
              onClick={handleAddToCart}
              disabled={!inStock}
            >
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{inStock ? 'Add to Cart' : 'Out of Stock'}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
