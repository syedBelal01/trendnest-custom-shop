import { Link, useParams } from 'react-router-dom';
import { categories } from '@/data/mockData';
import { useProducts } from '@/contexts/ProductsContext';
import ProductCard from '@/components/ProductCard';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Helmet } from 'react-helmet-async';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import {
  SEO_BRAND_NAME,
  SEO_DEFAULT_OG_IMAGE,
  SEO_DEFAULT_OG_IMAGE_HEIGHT,
  SEO_DEFAULT_OG_IMAGE_WIDTH,
  clampSeoTitle,
  ensureSeoMetaDescription,
  productCanonicalUrl,
} from '@/lib/seo';
import type { Product } from '@/types';
import { productDisplayPrice } from '@/lib/productPayment';
import { usePaymentMethod } from '@/contexts/PaymentMethodContext';

const CANONICAL_BASE = 'https://trendnest99.in';
const DEFAULT_OG_IMAGE = SEO_DEFAULT_OG_IMAGE;

type CategorySeoConfig = {
  title: string;
  description: string;
  keywords: string[];
  intro?: string;
  longIntro: string;
};

const CATEGORY_SEO: Record<string, CategorySeoConfig> = {
  home: {
    title: 'Home & Kitchen Online | TrendNest99',
    description:
      'Shop practical home & kitchen products online in India, including stylish utility items for everyday living at TrendNest99 with fast delivery.',
    keywords: ['home & kitchen', 'home products online', 'kitchen and bath essentials', 'trendnest99'],
    longIntro:
      "Home & kitchen products are no longer simple utility purchases. Most Indian shoppers now compare design, durability, and value before placing an order online. At TrendNest99, this category is curated for customers who want products that look clean, work reliably, and blend naturally into modern homes. Whether you are upgrading your bathroom setup, organizing a kitchen corner, or replacing daily-use accessories, the focus here is practical function with consistent finish quality. These listings are selected for everyday convenience so you can buy with confidence instead of trial and error.\n\nPeople searching for home & kitchen products online India or bathroom accessories online usually want clear product choices, not clutter. That is why this collection is structured around straightforward options with transparent pricing and relevant details. You can compare utility features, match finishes with your decor, and shortlist items that support frequent use without adding maintenance stress. If your goal is to build a more organized, comfortable living space with affordable online shopping, this section helps you move from discovery to checkout quickly.",
  },
  printed: {
    title: 'Printed T-Shirts Online | TrendNest99',
    description:
      "Shop printed T-shirts, graphic streetwear tees, and custom print options online in India. Bold designs, everyday comfort, and value pricing at TrendNest99.",
    keywords: [
      'printed t shirt online india',
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
    longIntro:
      "If you are searching for printed t shirt online India, this category is built around that exact purchase intent. TrendNest99 brings together graphic tees, bold back-print styles, and wearable streetwear looks that balance comfort with personality. From everyday round-neck prints to oversized silhouettes inspired by urban fashion, each listing is selected for shoppers who want standout design without compromising fabric feel, fit, or repeat wear quality. This is the right place for customers looking for men printed shirts online with modern visual identity and practical styling flexibility.\n\nBuyers also reach this section through queries like men's oversized graphic t-shirt India, printed shirt for casual wear, and custom print tee for gifting. To support those journeys, we keep the collection focused on useful details such as sleeve variants, size ranges, and design-led options that can be styled for daily outings or weekend looks. If you want printed apparel that feels premium, photographs well, and still fits a realistic budget for Indian online shopping, these products are curated to deliver both style impact and dependable value.",
  },
  trending: {
    title: 'Trending Products Online | TrendNest99',
    description:
      'Discover trending products and top customer picks in fashion, printed apparel, and home & kitchen essentials at TrendNest99 — shop what’s popular now.',
    keywords: ['trending products online', 'best selling products', 'latest fashion picks', 'trendnest99'],
    longIntro:
      "Trending products show what customers are actively discovering and buying right now. This category is ideal for shoppers who want a fast way to explore current favorites across fashion accessories, printed apparel, and practical essentials. Instead of opening multiple sections and comparing everything manually, you can start here with a curated shortlist shaped by ongoing demand and shopper behavior. For users searching trending products online India or best selling products in India, this page reduces decision friction while still giving enough variety.\n\nTime-sensitive shopping usually depends on relevance and trust. That is why this collection highlights products that combine visual appeal, practical use, and value-oriented pricing for everyday buyers. Whether you are shopping for yourself, evaluating gift options, or trying to catch what is popular this month, this feed helps you identify strong choices quickly. Open any listing for deeper details, compare top picks, and move to checkout with confidence using products that are already attracting real customer attention.",
  },
  fashion: {
    title: 'Mens Fashion Online | TrendNest99',
    description:
      'Shop mens fashion accessories and essentials online in India at TrendNest99 — practical styles, durable finishes, and value pricing for everyday wear.',
    keywords: ['fashion products online', 'latest fashion trends', 'men fashion online', 'men leather belt online india', 'trendnest99'],
    longIntro:
      "Fashion shopping online works best when style, comfort, and price stay in balance. This category is curated for people who want practical fashion essentials that can be worn regularly while still looking polished. From daily accessories to wardrobe-friendly picks, each product is chosen to support easy styling for work, travel, college, and casual plans. Customers searching mens fashion accessories online India often want reliable pieces that feel premium without becoming expensive impulse buys, and this collection is designed around that requirement.\n\nLong-tail searches such as men leather belt online India, affordable fashion accessories, and smart casual essentials for men reflect clear buying intent. To match that intent, we focus on usable designs, durable materials, and price points that fit real budgets. You can compare options by look, finish, and daily utility, then select products that blend easily with your existing outfits. If your goal is to shop fashion products online with less guesswork and better value, this category provides a clean path from search to purchase.",
  },
  electronics: {
    title: 'Electronics Online | TrendNest99',
    description:
      'Browse everyday electronics and useful gadgets online in India at TrendNest99. Practical accessories, clear pricing, and fast delivery support.',
    keywords: ['electronics online', 'gadgets and accessories', 'electronics store india', 'trendnest99'],
    longIntro:
      "Electronics accessories may be small purchases, but they have a big impact on daily convenience. This category is built for shoppers who want practical gadgets and useful add-ons for home, office, and travel routines. If you are searching electronics accessories online India, you will find product choices aimed at real-world usability instead of unnecessary complexity. The selection prioritizes dependable function, straightforward value, and clean product comparisons so you can buy quickly without overthinking technical details.\n\nBuyers often come with intent-based phrases like gadgets and accessories online, electronics store India, or affordable electronics essentials. To support that journey, this category keeps attention on products that are easy to use, easy to compare, and relevant for regular day-to-day use. Whether you are replacing an often-used accessory or trying a new gadget for convenience, these listings are organized to reduce confusion and improve purchase confidence. Explore top options, review practical details, and choose electronics essentials that match your workflow and budget.",
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
  return `${input.slice(0, max - 1).trimEnd()}...`;
}

function productShowsInCategory(product: Product, categoryId: string | undefined): boolean {
  const id = String(categoryId || '').trim();
  if (!id) return false;
  if (String(product.category || '') === id) return true;
  return Array.isArray(product.categories) && product.categories.some((c) => String(c) === id);
}

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { products, loading } = useProducts();
  const { method } = usePaymentMethod();
  const showSkeleton = useDelayedFlag(loading, 250);
  const [sort, setSort] = useState('default');

  const category = categories.find((c) => c.id === id);
  const filtered = useMemo(() => {
    let list =
      id === 'trending' ? products.filter((p) => p.isTrending) : products.filter((p) => productShowsInCategory(p, id));
    if (id === 'trending') {
      const ts = (pid: string) => {
        const m = String(pid || '').match(/\d{10,}/);
        const n = m ? Number(m[0]) : Number.NaN;
        return Number.isFinite(n) ? n : 0;
      };
      list = [...list].sort((a, b) => ts(b.id) - ts(a.id));
    }

    if (sort === 'low') list = [...list].sort((a, b) => productDisplayPrice(a, method) - productDisplayPrice(b, method));
    if (sort === 'high') list = [...list].sort((a, b) => productDisplayPrice(b, method) - productDisplayPrice(a, method));
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);

    return list;
  }, [id, products, sort, method]);

  const categoryName = category?.name || 'Products';
  const seoPreset = (id && CATEGORY_SEO[id]) || null;
  const title = clampSeoTitle(seoPreset?.title || `${categoryName} | TrendNest99`);
  const fallbackDesc = category?.description
    ? `${category.description} Browse ${filtered.length} products online in India at TrendNest99 with secure checkout and fast delivery.`
    : `Browse ${filtered.length} products online in India at TrendNest99. Discover fashion, home essentials, and daily deals with secure checkout.`;
  const desc = ensureSeoMetaDescription(truncate(stripHtml(seoPreset?.description || fallbackDesc), 160), 120, 160);
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
        url: productCanonicalUrl(p),
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
        <meta property="og:site_name" content={SEO_BRAND_NAME} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta property="og:image:secure_url" content={DEFAULT_OG_IMAGE} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content={String(SEO_DEFAULT_OG_IMAGE_WIDTH)} />
        <meta property="og:image:height" content={String(SEO_DEFAULT_OG_IMAGE_HEIGHT)} />
        <meta property="og:image:alt" content={`${SEO_BRAND_NAME} — ${categoryName}. Shop now.`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:image:alt" content={`${SEO_BRAND_NAME} — ${categoryName}. Shop now.`} />
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
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
