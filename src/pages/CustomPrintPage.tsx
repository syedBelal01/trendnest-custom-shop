import { useState, useRef, useEffect, useMemo } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadCustomDesign } from '@/lib/api';
import { productVariantNames } from '@/lib/productVariants';
import CustomPrintPreview from '@/components/custom/CustomPrintPreview';
import { resolveCustomPrintMockup } from '@/data/customPrintMockups';

export default function CustomPrintPage() {
  const { products } = useProducts();
  const customProducts = useMemo(() => products.filter(p => p.isCustomPrint), [products]);
  const { addItem } = useCart();
  const fileRef = useRef<HTMLInputElement>(null);

  const [productType, setProductType] = useState<'tshirt' | 'mug'>('tshirt');
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedVariant, setSelectedVariant] = useState('White');
  const [selectedSleeve, setSelectedSleeve] = useState('Half sleeve');
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedProduct = useMemo(
    () =>
      customProducts.find(p => (productType === 'tshirt' ? p.id === 'custom-tee' : p.id === 'custom-cup')) ||
      customProducts[0],
    [customProducts, productType]
  );

  useEffect(() => {
    if (!selectedProduct) return;
    setSelectedVariant(productVariantNames(selectedProduct)[0] || 'White');
    setSelectedSize(selectedProduct.sizes?.[0] || 'M');
    setSelectedSleeve(selectedProduct.sleeveTypes?.[0] || 'Half sleeve');
  }, [selectedProduct]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDesignFile(file);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const clearFile = () => {
    setDesignFile(null);
    setPreviewUrl(null);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleAddToCart = async () => {
    if (!designFile || !selectedProduct || uploading) return;
    setUploading(true);
    try {
      const url = await uploadCustomDesign(designFile);
      addItem({
        product: selectedProduct,
        quantity: 1,
        selectedSize: productType === 'tshirt' ? selectedSize : undefined,
        selectedVariant,
        selectedSleeve: productType === 'tshirt' && selectedProduct.sleeveTypes?.length ? selectedSleeve : undefined,
        customDesignFile: url,
        customDesignName: designFile.name,
        customProductType: productType,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload design');
    } finally {
      setUploading(false);
    }
  };

  const teeSizes = selectedProduct?.sizes ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const colorOptions =
    selectedProduct && productVariantNames(selectedProduct).length
      ? productVariantNames(selectedProduct)
      : ['White', 'Black', 'Gray'];

  const fallbackMockupUrl = selectedProduct?.images?.[0] ? String(selectedProduct.images[0]) : '';
  const styleKey = productType === 'tshirt' ? selectedSleeve : 'Default';
  const mock = resolveCustomPrintMockup({
    productType,
    color: selectedVariant,
    style: styleKey,
    fallbackMockupUrl,
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">🎨 Custom Print</h1>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">Upload your design and we&apos;ll print it on a premium product.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        <div>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/50 relative overflow-hidden"
          >
            {previewUrl ? (
              <>
                <CustomPrintPreview
                  mockupUrl={mock.mockupUrl}
                  designPreviewUrl={previewUrl}
                  printArea={mock.printArea}
                  productName={selectedProduct?.name || 'Custom product'}
                  className="w-full h-full"
                />
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); clearFile(); }}
                  className="absolute top-2 right-2 bg-foreground/80 text-background rounded-full p-1.5"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : designFile ? (
              <div className="text-center p-4">
                <p className="font-medium text-sm">{designFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">PDF file selected</p>
                <button type="button" onClick={e => { e.stopPropagation(); clearFile(); }} className="mt-2 text-primary text-sm hover:underline">Remove</button>
              </div>
            ) : (
              <>
                <Upload className="h-8 sm:h-10 w-8 sm:w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-sm">Click to upload design</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or PDF</p>
              </>
            )}
          </div>
          <Input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
        </div>

        <div className="space-y-5 sm:space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Product Type</label>
            <Select value={productType} onValueChange={(v: 'tshirt' | 'mug') => setProductType(v)}>
              <SelectTrigger className="h-10 sm:h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tshirt">T-shirt</SelectItem>
                <SelectItem value="mug">Cup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {productType === 'tshirt' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Size</label>
              <div className="flex gap-2 flex-wrap">
                {teeSizes.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSize(s)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedSize === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {productType === 'tshirt' && selectedProduct?.sleeveTypes && selectedProduct.sleeveTypes.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Sleeve</label>
              <div className="flex gap-2 flex-wrap">
                {selectedProduct.sleeveTypes.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSleeve(s)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedSleeve === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map(v => (
                <button key={v} type="button" onClick={() => setSelectedVariant(v)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedVariant === v ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{v}</button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-2xl font-bold">₹{selectedProduct?.price ?? 999}</p>
          </div>

          <Button
            size="lg"
            className="w-full gap-2 h-12 sm:h-11 text-sm sm:text-base font-semibold"
            disabled={!designFile || uploading}
            onClick={() => void handleAddToCart()}
          >
            <ShoppingCart className="h-4 w-4" />
            {uploading ? 'Uploading design…' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}
