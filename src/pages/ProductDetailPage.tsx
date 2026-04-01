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
  const { products } = useProducts();
  const product = products.find(p => p.id === id);
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [selectedSleeve, setSelectedSleeve] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!product) return;
    setSelectedSize(product.sizes?.[0] || '');
    setSelectedVariant(productVariantNames(product)[0] || '');
    setSelectedSleeve(product.sleeveTypes?.[0] || '');
    setQty(1);
  }, [product]);

  const variantNames = product ? productVariantNames(product) : [];
  const galleryImages = useMemo(
    () => (product ? galleryImagesForSelection(product, selectedVariant) : []),
    [product, selectedVariant]
  );

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-20 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Link to="/" className="text-primary hover:underline mt-4 inline-block">Go Home</Link>
      </div>
    );
  }

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

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
          resetKey={selectedVariant}
        />
        <div className="space-y-4 sm:space-y-6">
          {product.isTrending && (
            <span className="inline-block bg-foreground text-background text-xs font-semibold px-3 py-1 rounded-md">🔥 Trending</span>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{product.name}</h1>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl sm:text-4xl font-bold text-primary tabular-nums">₹{product.price}</span>
            {product.originalPrice != null && product.originalPrice > 0 && (
              <span className="text-sm sm:text-base text-muted-foreground line-through tabular-nums">₹{product.originalPrice}</span>
            )}
            {discount > 0 && (
              <span className="bg-primary/15 text-primary text-xs font-semibold px-2.5 py-1 rounded-md">{discount}% OFF</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex gap-0.5 text-lg leading-none" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < Math.round(product.rating) ? 'text-yellow-500' : 'text-muted-foreground/35'}>★</span>
              ))}
            </span>
            <span className="text-sm text-muted-foreground">({product.reviews.length} {product.reviews.length === 1 ? 'review' : 'reviews'})</span>
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

          {variantNames.length > 0 && (
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
                  selectedVariant: variantNames.length ? selectedVariant : undefined,
                  selectedSleeve: product.sleeveTypes?.length ? selectedSleeve : undefined,
                })
              }
            >
              <ShoppingCart className="h-5 w-5" /> Add to Cart
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {product.stock > 0 ? `✓ In stock (${product.stock} available)` : '✗ Out of stock'}
          </p>
        </div>
      </div>

      {product.reviews.length > 0 && (
        <div className="mt-8 sm:mt-12">
          <h2 className="text-lg sm:text-xl font-bold mb-4">Customer Reviews</h2>
          <div className="space-y-3 sm:space-y-4">
            {product.reviews.map(r => (
              <div key={r.id} className="border rounded-lg p-3 sm:p-4">
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
