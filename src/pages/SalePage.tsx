import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ProductCard from '@/components/ProductCard';
import type { Product, SaleBanner } from '@/types';
import { fetchPublicSaleBySlugApi } from '@/lib/heroBannersApi';
import { SEO_CANONICAL_BASE, ensureSeoMetaDescription } from '@/lib/seo';

type PublicSaleState = 'live' | 'scheduled' | 'ended' | 'draft' | 'disabled';

function stateMessage(state: PublicSaleState): string {
  if (state === 'scheduled') return 'This sale is scheduled and will go live soon.';
  if (state === 'ended') return 'This sale has ended.';
  if (state === 'disabled') return 'This sale is currently unavailable.';
  return 'This sale is not live right now.';
}

function saleThemeClasses(theme: SaleBanner['theme']): string {
  if (theme === 'summer') return 'from-amber-200/80 via-yellow-100 to-orange-100 border-amber-200';
  if (theme === 'winter') return 'from-sky-100 via-cyan-50 to-white border-sky-200';
  if (theme === 'eid') return 'from-emerald-100 via-teal-50 to-cyan-50 border-emerald-200';
  if (theme === 'holi') return 'from-pink-100 via-orange-50 to-indigo-100 border-fuchsia-200';
  return 'from-orange-100 via-orange-50 to-yellow-50 border-orange-200';
}

export default function SalePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<SaleBanner | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<PublicSaleState>('draft');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchPublicSaleBySlugApi(slug);
        if (cancelled) return;
        setSale(data.sale);
        setProducts(Array.isArray(data.products) ? data.products : []);
        setState(data.state);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load sale');
        setSale(null);
        setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const saleTitle = sale?.title || 'Sale';
  const pageTitle = `${saleTitle} | TrendNest99`;
  const pageDescription = ensureSeoMetaDescription(
    sale?.subtitle || sale?.bannerText || `Shop selected sale products from ${saleTitle} on TrendNest99.`
  );
  const canonicalUrl = `${SEO_CANONICAL_BASE}/sale/${encodeURIComponent(slug)}`;
  const saleBadgeText = useMemo(() => {
    const text = String(sale?.discountText || '').trim();
    if (text) return text;
    return 'Sale';
  }, [sale?.discountText]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="h-44 sm:h-56 rounded-2xl border bg-muted animate-pulse" />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-64 rounded-xl border bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-10">
        <div className="rounded-2xl border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold">Sale Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'The requested sale does not exist.'}</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>

      <section
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r p-4 sm:p-6 ${saleThemeClasses(
          sale.theme
        )}`}
      >
        {sale.desktopImage || sale.mobileImage ? (
          <picture className="absolute inset-0">
            {sale.desktopImage ? <source media="(min-width: 768px)" srcSet={sale.desktopImage} /> : null}
            <img
              src={sale.mobileImage || sale.desktopImage}
              alt={sale.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </picture>
        ) : null}
        {sale.desktopImage || sale.mobileImage ? <div className="absolute inset-0 bg-black/35" /> : null}
        <div className="relative z-10 max-w-2xl text-slate-900">
          <p className="inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {sale.theme === 'summer' ? 'Summer Sale' : 'Live Sale'}
          </p>
          <h1 className={`mt-3 text-2xl sm:text-4xl font-extrabold ${sale.desktopImage || sale.mobileImage ? 'text-white' : 'text-slate-900'}`}>
            {sale.bannerText?.trim() || `${sale.title} is Live`}
          </h1>
          <p className={`mt-2 text-sm sm:text-base ${sale.desktopImage || sale.mobileImage ? 'text-white/90' : 'text-slate-700'}`}>
            {sale.discountText?.trim() || sale.subtitle?.trim() || 'Limited time offers on selected products.'}
          </p>
        </div>
      </section>

      {state !== 'live' ? (
        <div className="mt-4 rounded-xl border bg-card p-4 text-center">
          <h2 className="text-lg font-semibold">{state === 'ended' ? 'Sale Ended' : 'Sale Not Live'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{stateMessage(state)}</p>
          <Link
            to="/"
            className="mt-3 inline-flex rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Continue Shopping
          </Link>
        </div>
      ) : null}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">{saleTitle} Products</h2>
          <span className="text-xs text-muted-foreground">{products.length} item(s)</span>
        </div>

        {products.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No products selected for this sale yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} saleBadgeText={saleBadgeText} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
