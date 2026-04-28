import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts } from '@/contexts/ProductsContext';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';

const CANONICAL_BASE = 'https://trendnest99.in';

export default function BestDealsPage() {
  const { products, loading } = useProducts();
  const showSkeleton = useDelayedFlag(loading, 250);
  const [sort, setSort] = useState('default');

  let filtered = [...products];

  if (sort === 'low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sort === 'high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  if (sort === 'rating') filtered = [...filtered].sort((a, b) => b.rating - a.rating);

  const title = 'Best Deals | TrendNest99';
  const desc = `Browse ${filtered.length} best deal products on TrendNest99.`;

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
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={`bestdeals-skel-${i}`} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={`${CANONICAL_BASE}/best-deals`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={`${CANONICAL_BASE}/best-deals`} />
      </Helmet>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">💰 Best Deals</h1>
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
        <p className="text-center text-muted-foreground py-20">
      No products found.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}

