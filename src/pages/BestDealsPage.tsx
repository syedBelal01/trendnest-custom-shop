import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useProducts } from '@/contexts/ProductsContext';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { productPrimaryImage } from '@/lib/productImages';
import { productVariantNames } from '@/lib/productVariants';
import type { Product } from '@/types';
import { Link } from 'react-router-dom';
import { type RatingSummary } from '@/lib/reviewsSummaryApi';
import { toast } from 'sonner';
import { ensureSeoMetaDescription, productImageAlt, productSeoPath, SEO_BRAND_NAME, SEO_DEFAULT_OG_IMAGE, SEO_DEFAULT_OG_IMAGE_HEIGHT, SEO_DEFAULT_OG_IMAGE_WIDTH } from '@/lib/seo';
import { productDisplayPrice, productDiscountPercent } from '@/lib/productPayment';
import { usePaymentMethod } from '@/contexts/PaymentMethodContext';

const CANONICAL_BASE = 'https://trendnest99.in';

const Icon = ({
  children,
  className = '',
  size = 20,
}: {
  children: React.ReactNode;
  className?: string;
  size?: number;
}) => (
  <span
    className={`inline-flex items-center justify-center ${className}`}
    style={{ width: size, height: size, fontSize: size, lineHeight: 1 }}
    aria-hidden
  >
    {children}
  </span>
);

const icons = {
  search: '⌕',
  cart: '🛒',
  user: '👤',
  heart: '♡',
  star: '★',
  flame: '🔥',
  deal: '💰',
  filter: '☰',
  arrow: '→',
  coupon: '🏷️',
  shield: '🛡️',
} as const;

function discountPercent(p: Product, displayPrice: number): number {
  return productDiscountPercent(p, displayPrice);
}

function avgFromRatingSummary(summary?: RatingSummary, fallback?: number): number {
  const v = summary?.avgRating;
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback ?? 0;
}

function countFromRatingSummary(summary?: RatingSummary, fallbackReviews?: number): number {
  if (summary?.reviewCount != null) return summary.reviewCount;
  return fallbackReviews ?? 0;
}

function stockFor(product: Product, selectedVariant?: string): number {
  if (product.variantModel?.items?.length && selectedVariant) {
    const hit = product.variantModel.items.find(v => String(v.key) === String(selectedVariant));
    if (hit) return Math.max(0, Number(hit.stock) || 0);
  }
  return Math.max(0, Number(product.stock) || 0);
}

function BestDealCard({
  product,
  ratingSummary,
  onAddToCart,
  onBuyNow,
}: {
  product: Product;
  ratingSummary: Record<string, RatingSummary>;
  onAddToCart: (p: Product) => void;
  onBuyNow: (p: Product) => void;
}) {
  const { method } = usePaymentMethod();
  const displayPrice = productDisplayPrice(product, method);
  const dp = discountPercent(product, displayPrice);
  const summary = ratingSummary[product.id];
  const avg = avgFromRatingSummary(summary, product.rating);
  const reviewCount = countFromRatingSummary(summary, Array.isArray(product.reviews) ? product.reviews.length : 0);
  const filledStars = Math.max(0, Math.min(5, Math.round(Number(avg) || 0)));

  return (
    <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-xl">
      <Link to={productSeoPath(product)} className="block relative aspect-square overflow-hidden bg-slate-100">
        <img
          src={productPrimaryImage(product)}
          alt={productImageAlt(product, 'best deals product photo')}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {dp > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-black text-white shadow-sm">
            {dp}% OFF
          </span>
        )}

        <button className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-slate-950/80 text-orange-400 shadow-sm transition hover:bg-white hover:text-orange-600" type="button">
          <Icon size={17}>{icons.heart}</Icon>
        </button>
      </Link>

      <div className="p-3">
        <Link to={productSeoPath(product)}>
          <h3 className="line-clamp-2 min-h-[34px] text-sm font-black leading-5 text-slate-950 transition-colors hover:text-orange-600">
            {product.name}
          </h3>
        </Link>

        <div className="mt-2 flex items-end gap-2">
          <span className="text-lg font-black text-slate-950">₹{displayPrice}</span>
          {product.originalPrice ? (
            <span className="pb-0.5 text-xs text-slate-400 line-through">₹{product.originalPrice}</span>
          ) : null}
        </div>

        {reviewCount > 0 ? (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, index) => (
                <Icon key={index} size={12} className={index < filledStars ? "text-amber-400" : "text-slate-200"}>
                  {index < filledStars ? icons.star : "☆"}
                </Icon>
              ))}
            </div>
            <span>
              {avg.toFixed(1)} ({reviewCount} reviews)
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-xs font-semibold text-slate-400">No ratings yet</p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="flex h-10 items-center justify-center gap-1 rounded-xl border border-orange-200 bg-white text-xs font-black text-orange-600 shadow-sm transition hover:bg-orange-50 active:scale-[0.98] sm:text-sm"
          >
            <Icon size={14}>{icons.cart}</Icon> Cart
          </button>

          <button
            type="button"
            onClick={() => onBuyNow(product)}
            className="flex h-10 items-center justify-center gap-1 rounded-xl bg-orange-600 text-xs font-black text-white shadow-lg shadow-orange-600/15 transition hover:bg-orange-700 active:scale-[0.98] sm:text-sm"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BestDealsPage() {
  const { products, ratingSummary, loading } = useProducts();
  const { method } = usePaymentMethod();
  const showSkeleton = useDelayedFlag(loading, 250);
  const [sort, setSort] = useState<'default' | 'low-high' | 'high-low' | 'rating' | 'discount'>('default');

  const sortedProducts = useMemo(() => {
    const list = [...(products ?? [])];

    if (sort === 'low-high') {
      return list.sort((a, b) => productDisplayPrice(a, method) - productDisplayPrice(b, method));
    }
    if (sort === 'high-low') {
      return list.sort((a, b) => productDisplayPrice(b, method) - productDisplayPrice(a, method));
    }
    if (sort === 'rating') {
      return list.sort((a, b) => {
        const ra = avgFromRatingSummary(ratingSummary[a.id], a.rating);
        const rb = avgFromRatingSummary(ratingSummary[b.id], b.rating);
        return rb - ra;
      });
    }
    if (sort === 'discount') {
      return list.sort(
        (a, b) =>
          discountPercent(b, productDisplayPrice(b, method)) - discountPercent(a, productDisplayPrice(a, method))
      );
    }

    return list;
  }, [products, ratingSummary, sort, method]);

  const { addItem } = useCart();
  const navigate = useNavigate();

  const add = (p: Product) => {
    addItem({
      product: p,
      quantity: 1,
      selectedSize: p.sizes?.[0],
      selectedVariant: p.variantModel?.items?.[0]?.key ?? productVariantNames(p)[0],
      selectedSleeve: p.sleeveTypes?.[0],
    });
  };

  const buyNow = (p: Product) => {
    const selectedVariant = p.variantModel?.items?.[0]?.key ?? productVariantNames(p)[0];
    const max = stockFor(p, selectedVariant);
    if (max <= 0) {
      toast.error('This item is out of stock.');
      return;
    }

    add(p);
    navigate('/checkout');
  };

  const title = 'Best Deals | TrendNest99';
  const desc = ensureSeoMetaDescription(
    `Browse ${sortedProducts.length} best deal products on TrendNest99. Discover fashion accessories, printed t-shirts, and home & kitchen products with strong value pricing for Indian shoppers.`,
    120,
    160
  );

  if (showSkeleton) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-6 sm:mb-8">
          <div className="space-y-2">
            <div className="h-8 w-56 rounded-md bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="h-10 sm:h-9 w-full sm:w-44 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={`bestdeals-skel-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white font-sans text-slate-900">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={`${CANONICAL_BASE}/best-deals`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SEO_BRAND_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={`${CANONICAL_BASE}/best-deals`} />
        <meta property="og:image" content={SEO_DEFAULT_OG_IMAGE} />
        <meta property="og:image:width" content={String(SEO_DEFAULT_OG_IMAGE_WIDTH)} />
        <meta property="og:image:height" content={String(SEO_DEFAULT_OG_IMAGE_HEIGHT)} />
        <meta property="og:image:alt" content={`${SEO_BRAND_NAME} best deals. Shop now.`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={SEO_DEFAULT_OG_IMAGE} />
      </Helmet>

      <section className="mx-auto max-w-7xl px-4 py-3 md:px-8">
        <div className="relative mb-4 overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-4 shadow-sm md:p-5">
          <div className="absolute right-10 top-6 h-28 w-28 rounded-full bg-orange-200/40 blur-2xl" />
          <div className="absolute bottom-4 left-1/3 h-16 w-16 rounded-full bg-orange-300/20 blur-2xl" />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-black text-orange-600 shadow-sm">
                <Icon size={15}>{icons.deal}</Icon> Limited Time Deals
              </span>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 md:text-4xl">Best Deals</h1>
              <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">
                Discover top discounts on fashion, custom prints, home & kitchen products and trending products.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-orange-100 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <Icon size={20}>{icons.filter}</Icon>
            </div>
            <div>
              <h2 className="font-black text-slate-950">Filter & Sort</h2>
              <p className="text-sm text-slate-500">Find the best offers quickly.</p>
            </div>
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-orange-400 sm:w-56"
          >
            <option value="default">Default</option>
            <option value="low-high">Price: Low to High</option>
            <option value="high-low">Price: High to Low</option>
            <option value="rating">Top Rated</option>
            <option value="discount">Best Discount</option>
          </select>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {sortedProducts.length ? (
            sortedProducts.map((product) => (
              <BestDealCard
                key={product.id}
                product={product}
                ratingSummary={ratingSummary}
                onAddToCart={add}
                onBuyNow={buyNow}
              />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-20">No products found.</p>
          )}
        </div>

        <div className="mt-6 rounded-3xl bg-orange-600 p-4 text-center text-white shadow-xl shadow-orange-600/20 md:p-5">
          <h2 className="text-lg font-black">Use Code WELCOME10</h2>
          <p className="mt-1 text-sm text-white/85">Get extra 10% off on your first order.</p>
          <Link to="/category/trending">
            <button type="button" className="mt-2 rounded-2xl bg-white px-6 py-2 text-sm font-black text-orange-600">
              Shop More <Icon size={15}>{icons.arrow}</Icon>
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
