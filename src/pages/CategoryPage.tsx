import { useParams } from 'react-router-dom';
import { categories } from '@/data/mockData';
import { useProducts } from '@/contexts/ProductsContext';
import ProductCard from '@/components/ProductCard';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Helmet } from 'react-helmet-async';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';

const CANONICAL_BASE = 'https://trendnest99.in';
const DEFAULT_OG_IMAGE = `${CANONICAL_BASE}/img3.jpeg`;

type CategorySeoConfig = {
  title: string;
  description: string;
  keywords: string[];
  intro?: string;
};

const CATEGORY_SEO: Record<string, CategorySeoConfig> = {
  home: {
    title: 'Home Essentials Online in India | TrendNest99',
    description:
      'Shop practical home essentials online in India, including stylish utility products for everyday living at TrendNest99.',
    keywords: ['home essentials', 'home products online', 'kitchen and bath essentials', 'trendnest99'],
  },
  printed: {
    title: 'Printed T-Shirts for Men, Graphic Tees & Custom Prints | TrendNest99',
    description:
      "Shop printed T-shirts, printed shirts, and men's oversized graphic T-shirts online. Discover streetwear styles like Broken Rules back print tees and custom print options at TrendNest99.",
    keywords: [
      'printed t shirt',
      'printed shirt',
      'printed t-shirt for men',
      "men's oversized graphic t-shirt",
      'graphic streetwear tee',
      'broken rules back print',
      'custom print t shirt',
      'trendnest99',
    ],
    intro:
      'Explore premium printed T-shirts and graphic streetwear designs with fresh drops, bold back prints, and custom print options.',
  },
  trending: {
    title: 'Trending Products Online | TrendNest99',
    description:
      'Discover trending products and top customer picks in fashion, printed apparel, and home essentials at TrendNest99.',
    keywords: ['trending products online', 'best selling products', 'latest fashion picks', 'trendnest99'],
  },
  fashion: {
    title: 'Fashion Products Online | TrendNest99',
    description: 'Shop latest fashion essentials and accessories online at TrendNest99.',
    keywords: ['fashion products online', 'latest fashion trends', 'men fashion online', 'trendnest99'],
  },
  electronics: {
    title: 'Electronics & Accessories Online | TrendNest99',
    description: 'Browse everyday electronics and useful accessories online at TrendNest99.',
    keywords: ['electronics online', 'gadgets and accessories', 'electronics store india', 'trendnest99'],
  },
};

function stripHtml(input: string): string {
  return String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(input: string, max = 160): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useProducts();
  const showSkeleton = useDelayedFlag(loading, 250);
  const [sort, setSort] = useState('default');

  const category = categories.find(c => c.id === id);
  let filtered =
    id === 'trending' ? products.filter(p => p.isTrending) : products.filter(p => p.category === id);
  // Trending: newest-first (admin displayOrder is per-category and not used here).
  if (id === 'trending') {
    const ts = (pid: string) => {
      const m = String(pid || '').match(/\d{10,}/);
      const n = m ? Number(m[0]) : NaN;
      return Number.isFinite(n) ? n : 0;
    };
    filtered = [...filtered].sort((a, b) => ts(b.id) - ts(a.id));
  }

  if (sort === 'low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sort === 'high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  if (sort === 'rating') filtered = [...filtered].sort((a, b) => b.rating - a.rating);

  const categoryName = category?.name || 'Products';
  const seoPreset = (id && CATEGORY_SEO[id]) || null;
  const title = seoPreset?.title || `${categoryName} | TrendNest99`;
  const fallbackDesc = category?.description
    ? `${category.description} Browse ${filtered.length} products on TrendNest99.`
    : `Browse ${filtered.length} products on TrendNest99.`;
  const desc = truncate(stripHtml(seoPreset?.description || fallbackDesc), 160);
  const canonicalUrl = id ? `${CANONICAL_BASE}/category/${encodeURIComponent(id)}` : `${CANONICAL_BASE}/category`;
  const keywords = Array.from(
    new Set([
      ...(seoPreset?.keywords || []),
      categoryName,
      ...filtered.slice(0, 6).map((p) => String(p.name || '').trim()).filter(Boolean),
    ])
  ).join(', ');
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${CANONICAL_BASE}/` },
      { '@type': 'ListItem', position: 2, name: categoryName, item: canonicalUrl },
    ],
  };
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryName,
    description: desc,
    url: canonicalUrl,
    isPartOf: { '@type': 'WebSite', name: 'TrendNest99', url: `${CANONICAL_BASE}/` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: filtered.slice(0, 12).map((p, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${CANONICAL_BASE}/product/${encodeURIComponent(String(p.id || ''))}`,
        name: p.name,
      })),
    },
  };

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
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={`cat-skel-${i}`} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta name="keywords" content={keywords} />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(collectionJsonLd)}</script>
      </Helmet>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{category?.icon} {category?.name || 'Products'}</h1>
          {seoPreset?.intro ? <p className="text-sm text-muted-foreground mt-1">{seoPreset.intro}</p> : null}
          <p className="text-sm text-muted-foreground mt-0.5 sm:mt-1">{filtered.length} products</p>
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-44 h-10 sm:h-9">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="low">Price: Low to High</SelectItem>
            <SelectItem value="high">Price: High to Low</SelectItem>
            <SelectItem value="rating">Top Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">No products found in this category.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
