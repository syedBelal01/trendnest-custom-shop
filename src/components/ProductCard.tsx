import { Link } from 'react-router-dom';
import { Product } from '@/types';
import { productPrimaryImage } from '@/lib/productImages';
import { productVariantNames } from '@/lib/productVariants';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart } from 'lucide-react';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="group bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
      <Link to={`/product/${product.id}`} className="block aspect-square overflow-hidden relative">
        <img src={productPrimaryImage(product)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-md">{discount}% OFF</span>
        )}
        {product.isTrending && (
          <span className="absolute top-2 right-2 bg-foreground text-background text-xs font-semibold px-2 py-1 rounded-md">🔥 Trending</span>
        )}
      </Link>
      <div className="p-3">
        <Link to={`/product/${product.id}`}>
          <h3 className="font-medium text-sm truncate hover:text-primary transition-colors">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-bold text-base">₹{product.price}</span>
          {product.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">₹{product.originalPrice}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-yellow-500 text-xs">{'★'.repeat(Math.round(product.rating))}</span>
          <span className="text-xs text-muted-foreground">({product.reviews.length})</span>
        </div>
        <Button size="sm" className="w-full mt-3 h-8 text-xs gap-1" onClick={() => addItem({
          product, quantity: 1,
          selectedSize: product.sizes?.[0],
          selectedVariant: productVariantNames(product)[0],
          selectedSleeve: product.sleeveTypes?.[0],
        })}>
          <ShoppingCart className="h-3 w-3" /> Add to Cart
        </Button>
      </div>
    </div>
  );
}
