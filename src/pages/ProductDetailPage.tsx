import { useParams, Link } from 'react-router-dom';
import { products } from '@/data/mockData';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ShoppingCart, ArrowLeft } from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const product = products.find(p => p.id === id);
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || '');
  const [selectedVariant, setSelectedVariant] = useState(product?.variants?.[0] || '');
  const [qty, setQty] = useState(1);

  if (!product) return <div className="max-w-7xl mx-auto px-4 py-20 text-center"><p className="text-muted-foreground">Product not found.</p><Link to="/" className="text-primary hover:underline mt-4 inline-block">Go Home</Link></div>;

  const discount = product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link to={`/category/${product.category}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-xl overflow-hidden border bg-muted">
          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <div className="space-y-5">
          {product.isTrending && <span className="inline-block bg-foreground text-background text-xs font-semibold px-3 py-1 rounded-md">🔥 Trending</span>}
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">₹{product.price}</span>
            {product.originalPrice && <span className="text-lg text-muted-foreground line-through">₹{product.originalPrice}</span>}
            {discount > 0 && <span className="bg-primary/10 text-primary text-sm font-semibold px-2 py-0.5 rounded">{discount}% OFF</span>}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-yellow-500">{'★'.repeat(Math.round(product.rating))}</span>
            <span className="text-sm text-muted-foreground">({product.reviews.length} reviews)</span>
          </div>
          <p className="text-muted-foreground">{product.description}</p>

          {product.sizes && product.sizes.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Size</p>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map(s => (
                  <button key={s} onClick={() => setSelectedSize(s)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedSize === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {product.variants && product.variants.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Color / Variant</p>
              <div className="flex gap-2 flex-wrap">
                {product.variants.map(v => (
                  <button key={v} onClick={() => setSelectedVariant(v)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedVariant === v ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{v}</button>
                ))}
              </div>
            </div>
          )}

          {product.isCustomPrint && (
            <Link to="/custom-print" className="block">
              <Button variant="outline" className="w-full">🎨 Upload Custom Design →</Button>
            </Link>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md">
              <button className="px-3 py-2 hover:bg-accent" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="px-4 py-2 border-x text-sm font-medium">{qty}</span>
              <button className="px-3 py-2 hover:bg-accent" onClick={() => setQty(qty + 1)}>+</button>
            </div>
            <Button size="lg" className="flex-1 gap-2" onClick={() => addItem({ product, quantity: qty, selectedSize, selectedVariant })}>
              <ShoppingCart className="h-4 w-4" /> Add to Cart
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">{product.stock > 0 ? `✓ In stock (${product.stock} available)` : '✗ Out of stock'}</p>
        </div>
      </div>

      {/* Reviews */}
      {product.reviews.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">Customer Reviews</h2>
          <div className="space-y-4">
            {product.reviews.map(r => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.userName}</span>
                  <span className="text-yellow-500 text-sm">{'★'.repeat(r.rating)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{r.comment}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
