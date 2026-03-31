import { useSearchParams } from 'react-router-dom';
import { products } from '@/data/mockData';
import ProductCard from '@/components/ProductCard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';

export default function SearchPage() {
  const [params] = useSearchParams();
  const initial = params.get('q') || '';
  const [query, setQuery] = useState(initial);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.includes(q) ||
      p.subcategory?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.includes(q))
    );
  }, [query]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="relative max-w-lg mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for products..." className="pl-10 h-12 text-base" autoFocus />
      </div>
      {query.trim() && (
        <p className="text-sm text-muted-foreground mb-6">{results.length} result{results.length !== 1 ? 's' : ''} for "{query}"</p>
      )}
      {results.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : query.trim() ? (
        <p className="text-center text-muted-foreground py-20">No products found. Try a different search.</p>
      ) : null}
    </div>
  );
}
