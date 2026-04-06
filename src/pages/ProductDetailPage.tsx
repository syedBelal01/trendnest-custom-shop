import { useParams, Link } from 'react-router-dom';
import { useProducts } from '@/contexts/ProductsContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import ProductImageGallery from '@/components/ProductImageGallery';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import type { Product } from '@/types';
import { productVariantNames } from '@/lib/productVariants';
import { galleryImagesForSelection } from '@/lib/productImages';
import { fetchProductReviewsApi, type Review as ApiReview } from '@/lib/reviewsApi';
import { fetchProductByIdApi } from '@/lib/api';
import { parseProductSpecifications } from '@/lib/productSpecifications';

/** Normalize for case/whitespace-insensitive variant matching */
function normKey(s: string) {
  return String(s ?? '').trim().toLowerCase();
}
function normVal(s: string) {
  return String(s ?? '').trim().toLowerCase();
}

function getAttrValueCaseInsensitive(attrs: Record<string, string> | undefined, typeName: string): string {
  if (!attrs) return '';
  const nk = normKey(typeName);
  if (Object.prototype.hasOwnProperty.call(attrs, typeName) && attrs[typeName] != null) {
    return String(attrs[typeName]);
  }
  const key = Object.keys(attrs).find(k => normKey(k) === nk);
  return key ? String(attrs[key] ?? '') : '';
}

function dedupeImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter(u => {
    const s = String(u).trim();
    if (!s || seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

/** Dev: logs in Vite dev; prod: set `localStorage.setItem('pdpVariantDebug','1')`. Remove when verified. */
function isPdpVariantDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  try {
    return window.localStorage.getItem('pdpVariantDebug') === '1';
  } catch {
    return false;
  }
}

function variantOptionLabel(product: Product): string {
  if (product.subcategory === 'Belts') return 'Leather color';
  if (product.category === 'home') return 'Finish';
  return 'Color';
}

const pillOption = (active: boolean) =>
  `rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium border transition-colors ${
    active
      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
      : 'bg-background text-foreground border-border hover:border-muted-foreground/40'
  }`;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { products, ratingSummary } = useProducts();
  const fromList = id ? products.find(p => p.id === id) : undefined;
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = () => {
      void (async () => {
        const one = await fetchProductByIdApi(id);
        if (!cancelled && one) setFetchedProduct(one);
      })();
    };
    load();
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    const onProductUpdated = (e: Event) => {
      const ce = e as CustomEvent<{ id?: string }>;
      if (ce.detail?.id === id) load();
    };
    window.addEventListener('trendnest:product-updated', onProductUpdated);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('trendnest:product-updated', onProductUpdated);
    };
  }, [id]);

  const product = fetchedProduct ?? fromList;
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(''); // legacy single variant
  const [selectedVariantKey, setSelectedVariantKey] = useState(''); // variantModel key
  const [variantAttrs, setVariantAttrs] = useState<Record<string, string>>({});
  const [selectedSleeve, setSelectedSleeve] = useState('');
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [reviewsCursor, setReviewsCursor] = useState<string | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const hasVariantModel = !!(product?.variantModel?.types?.length && product?.variantModel?.items?.length);

  /** Single source of truth: derive from `selectedVariantKey` only (see plan: robustness B). */
  const selectedVariantItem = useMemo(() => {
    if (!product?.variantModel?.items?.length) return null;
    const items = product.variantModel.items;
    if (selectedVariantKey) {
      const hit = items.find(x => x.key === selectedVariantKey);
      if (hit) return hit;
    }
    return items[0] ?? null;
  }, [product, selectedVariantKey]);

  useEffect(() => {
    if (!isPdpVariantDebugEnabled() || !hasVariantModel) return;
    // eslint-disable-next-line no-console -- intentional debug when flag / dev enabled
    console.log('[PDP variant]', {
      selectedVariantKey,
      selectedVariantItem,
      variantImages: selectedVariantItem?.images,
    });
  }, [hasVariantModel, selectedVariantKey, selectedVariantItem]);

  useEffect(() => {
    if (!product) return;
    setSelectedSize(product.sizes?.[0] || '');
    if (product.variantModel?.items?.length) {
      const first = product.variantModel.items[0];
      setSelectedVariantKey(first.key);
      setVariantAttrs({ ...(first.attrs ?? {}) });
      setSelectedVariant(''); // legacy cleared
    } else {
      setSelectedVariant(productVariantNames(product)[0] || '');
      setSelectedVariantKey('');
      setVariantAttrs({});
    }
    setSelectedSleeve(product.sleeveTypes?.[0] || '');
    setQty(1);
  }, [product]);

  useEffect(() => {
    if (!product?.id) return;
    let mounted = true;
    setReviewsLoading(true);
    void (async () => {
      try {
        const r = await fetchProductReviewsApi({ productId: product.id, limit: 5 });
        if (!mounted) return;
        setReviews(r.reviews);
        setReviewsCursor(r.nextCursor);
      } finally {
        if (mounted) setReviewsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [product?.id]);

  const loadMoreReviews = async () => {
    if (!product?.id || !reviewsCursor || reviewsLoading) return;
    setReviewsLoading(true);
    try {
      const r = await fetchProductReviewsApi({ productId: product.id, limit: 10, cursor: reviewsCursor });
      setReviews(prev => [...prev, ...r.reviews]);
      setReviewsCursor(r.nextCursor);
    } finally {
      setReviewsLoading(false);
    }
  };

  const variantNames = product ? productVariantNames(product) : [];
  const galleryImages = useMemo(
    () => {
      if (!product) return [];
      if (hasVariantModel && selectedVariantItem) {
        const variantImages = (Array.isArray(selectedVariantItem.images) ? selectedVariantItem.images : [])
          .map((u: unknown) => String(u).trim())
          .filter(Boolean);
        const legacyImg = selectedVariantItem.image ? String(selectedVariantItem.image).trim() : '';

        // If variant has no images at all, fall back completely to product images (do not mix).
        if (variantImages.length === 0 && !legacyImg) {
          return dedupeImageUrls((product.images ?? []).map(u => String(u).trim()).filter(Boolean));
        }

        // Prefer variant images (primary = images[0]), then append product.images; dedupe.
        const primaryList = variantImages.length > 0 ? variantImages : legacyImg ? [legacyImg] : [];
        const productRest = (product.images ?? []).map(u => String(u).trim()).filter(Boolean);
        return dedupeImageUrls([...primaryList, ...productRest]);
      }
      return galleryImagesForSelection(product, selectedVariant);
    },
    [product, selectedVariant, hasVariantModel, selectedVariantItem]
  );

  // Must be declared before any conditional returns (Rules of Hooks).
  const specRows = useMemo(() => {
    if (!product) return [];
    if (fetchedProduct) return parseProductSpecifications(fetchedProduct);
    return parseProductSpecifications(product);
  }, [product, fetchedProduct]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-20 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">Go Home</Link>
      </div>
    );
  }

  const displayPrice = hasVariantModel && selectedVariantItem ? Number(selectedVariantItem.price) : product.price;
  const displayOnlinePrice =
    hasVariantModel && selectedVariantItem && selectedVariantItem.onlinePrice != null
      ? Number(selectedVariantItem.onlinePrice)
      : product.onlinePrice != null
        ? Number(product.onlinePrice)
        : null;

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - displayPrice) / product.originalPrice) * 100)
    : 0;

  const summary = ratingSummary[product.id];
  const avg = summary?.avgRating ?? 0;
  const count = summary?.reviewCount ?? 0;
  const filled = Math.round(avg);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <Link
        to={product.category === 'fashion' ? '/#fashion-picks' : `/category/${product.category}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:items-start">
        <ProductImageGallery
          productId={product.id}
          images={galleryImages}
          productName={product.name}
          resetKey={hasVariantModel ? selectedVariantKey : selectedVariant}
        />
        <div className="space-y-4 sm:space-y-6">
          {product.isTrending && (
            <span className="inline-block bg-foreground text-background text-xs font-semibold px-3 py-1 rounded-md">🔥 Trending</span>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.name}</h1>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl sm:text-4xl font-bold text-primary tabular-nums">₹{displayPrice}</span>
            {product.originalPrice != null && product.originalPrice > 0 && (
              <span className="text-sm sm:text-base text-muted-foreground line-through tabular-nums">₹{product.originalPrice}</span>
            )}
            {discount > 0 && (
              <span className="bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1 rounded-md">{discount}% OFF</span>
            )}
          </div>
          {displayOnlinePrice != null && Number.isFinite(displayOnlinePrice) && displayOnlinePrice > 0 && (
            <p className="text-xs text-muted-foreground -mt-2">
              Online payment price: <span className="font-semibold tabular-nums text-foreground">₹{displayOnlinePrice}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex gap-0.5 text-lg leading-none"
              onClick={() => document.getElementById('customer-reviews')?.scrollIntoView({ behavior: 'smooth' })}
              aria-label="Scroll to reviews"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < filled ? 'text-yellow-500' : 'text-muted-foreground/35'} aria-hidden>
                  ★
                </span>
              ))}
            </button>
            <span className="text-sm text-muted-foreground">({count} {count === 1 ? 'review' : 'reviews'})</span>
          </div>

          <p className="text-muted-foreground text-sm sm:text-[15px] leading-relaxed">{product.description}</p>

          {product.sizes && product.sizes.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <p className="text-sm sm:text-base font-semibold text-foreground">Size</p>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSize(s)} className={pillOption(selectedSize === s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {product.sleeveTypes && product.sleeveTypes.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <p className="text-sm sm:text-base font-semibold text-foreground">Sleeve</p>
              <div className="flex gap-2 flex-wrap">
                {product.sleeveTypes.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSleeve(s)} className={pillOption(selectedSleeve === s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {hasVariantModel && product.variantModel ? (
            <div className="space-y-3">
              {product.variantModel.types.map(t => (
                <div key={t.name} className="space-y-2">
                  <p className="text-sm sm:text-base font-semibold text-foreground">{t.name}</p>
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
                            const hit =
                              items.find(x => {
                                const attrs = (x as { attrs?: Record<string, string> }).attrs;
                                return types.every(ty => {
                                  const sel = String(next[ty.name] ?? '').trim();
                                  const itemVal = getAttrValueCaseInsensitive(attrs, ty.name);
                                  return normVal(itemVal) === normVal(sel);
                                });
                              }) ?? null;
                            if (hit) {
                              setSelectedVariantKey(hit.key);
                            } else {
                              const first = items[0];
                              if (first) {
                                setSelectedVariantKey(first.key);
                                setVariantAttrs({ ...(first.attrs ?? {}) });
                              }
                            }
                          }}
                          className={pillOption(active)}
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
            <div className="space-y-2 sm:space-y-3">
              <p className="text-sm sm:text-base font-semibold text-foreground">{variantOptionLabel(product)}</p>
              <div className="flex gap-2 flex-wrap">
                {variantNames.map(v => (
                  <button key={v} type="button" onClick={() => setSelectedVariant(v)} className={pillOption(selectedVariant === v)}>{v}</button>
                ))}
              </div>
            </div>
          )}

          {product.isCustomPrint && (
            <Link to="/custom-print" className="block">
              <Button variant="outline" className="w-full rounded-full h-11">🎨 Upload Custom Design →</Button>
            </Link>
          )}

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="inline-flex shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-background text-sm font-medium self-start">
              <button type="button" className="px-4 py-3 hover:bg-muted/80 active:bg-muted min-w-[2.75rem]" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="flex min-w-[3rem] items-center justify-center border-x border-border px-2 tabular-nums">{qty}</span>
              <button type="button" className="px-4 py-3 hover:bg-muted/80 active:bg-muted min-w-[2.75rem]" onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <Button
              size="lg"
              className="h-12 sm:h-auto sm:min-h-[3rem] flex-1 gap-2 rounded-lg py-3 text-base font-semibold sm:min-w-0"
              onClick={() =>
                addItem({
                  product,
                  quantity: qty,
                  selectedSize: product.sizes?.length ? selectedSize : undefined,
                  selectedVariant: hasVariantModel
                    ? (selectedVariantItem?.key ?? undefined)
                    : variantNames.length
                      ? selectedVariant
                      : undefined,
                  selectedSleeve: product.sleeveTypes?.length ? selectedSleeve : undefined,
                })
              }
            >
              <ShoppingCart className="h-5 w-5" /> Add to Cart
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {((hasVariantModel && selectedVariantItem) ? selectedVariantItem.stock : product.stock) > 0
              ? `✓ In stock (${(hasVariantModel && selectedVariantItem) ? selectedVariantItem.stock : product.stock} available)`
              : '✗ Out of stock'}
          </p>

          {specRows.length > 0 && (
            <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-5">
              <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3">Product details</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,11rem)_1fr] gap-x-6 gap-y-2 text-sm">
                {specRows.map((row, i) => (
                  <div key={`${row.label}-${i}`} className="contents">
                    <dt className="text-muted-foreground py-1 sm:py-0.5 border-b border-border/60 sm:border-0 font-medium">
                      {row.label.trim()}
                    </dt>
                    <dd className="text-foreground pb-2 sm:pb-1 sm:pt-0.5 border-b border-border/60 last:border-0 sm:border-0">
                      {row.value.trim()}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {(reviewsLoading || reviews.length > 0) && (
        <div id="customer-reviews" className="mt-8 sm:mt-12 scroll-mt-24">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Customer Reviews</h2>
          <div className="space-y-3 sm:space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="border rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.userName}</span>
                  <span className="text-yellow-500 text-sm">{'★'.repeat(r.rating)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
                {r.images?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.images.slice(0, 4).map((img, idx) => (
                      <a key={idx} href={img.url} target="_blank" rel="noreferrer">
                        <img src={img.url} alt="Review" className="h-16 w-16 rounded-md object-cover border" />
                      </a>
                    ))}
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </p>
              </div>
            ))}
            {reviewsLoading && (
              <div className="text-sm text-muted-foreground">Loading reviews…</div>
            )}
          </div>
          {reviewsCursor && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => void loadMoreReviews()} disabled={reviewsLoading} className="w-full sm:w-auto">
                {reviewsLoading ? 'Loading…' : 'See More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
