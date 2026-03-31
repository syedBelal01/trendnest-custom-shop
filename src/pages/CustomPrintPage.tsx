import { useState, useRef } from 'react';
import { products } from '@/data/mockData';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ShoppingCart, X } from 'lucide-react';

export default function CustomPrintPage() {
  const customProducts = products.filter(p => p.isCustomPrint);
  const { addItem } = useCart();
  const fileRef = useRef<HTMLInputElement>(null);

  const [productType, setProductType] = useState<'tshirt' | 'mug'>('tshirt');
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedVariant, setSelectedVariant] = useState('White');
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedProduct = customProducts.find(p =>
    productType === 'tshirt' ? p.name.toLowerCase().includes('t-shirt') : p.name.toLowerCase().includes('mug')
  ) || customProducts[0];

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

  const clearFile = () => { setDesignFile(null); setPreviewUrl(null); };

  const handleAddToCart = () => {
    if (!designFile || !selectedProduct) return;
    addItem({
      product: selectedProduct,
      quantity: 1,
      selectedSize: productType === 'tshirt' ? selectedSize : undefined,
      selectedVariant,
      customDesignFile: previewUrl || designFile.name,
      customDesignName: designFile.name,
      customProductType: productType,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">🎨 Custom Print</h1>
      <p className="text-muted-foreground mb-8">Upload your design and we'll print it on a premium product.</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upload area */}
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/50 relative overflow-hidden"
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                <button onClick={e => { e.stopPropagation(); clearFile(); }} className="absolute top-2 right-2 bg-foreground/80 text-background rounded-full p-1"><X className="h-4 w-4" /></button>
              </>
            ) : designFile ? (
              <div className="text-center p-4">
                <p className="font-medium">{designFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">PDF file selected</p>
                <button onClick={e => { e.stopPropagation(); clearFile(); }} className="mt-2 text-primary text-sm hover:underline">Remove</button>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-sm">Click to upload design</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or PDF</p>
              </>
            )}
          </div>
          <Input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
        </div>

        {/* Options */}
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Product Type</label>
            <Select value={productType} onValueChange={(v: 'tshirt' | 'mug') => setProductType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tshirt">T-shirt</SelectItem>
                <SelectItem value="mug">Mug</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {productType === 'tshirt' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Size</label>
              <div className="flex gap-2 flex-wrap">
                {['S','M','L','XL','XXL'].map(s => (
                  <button key={s} onClick={() => setSelectedSize(s)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedSize === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {(productType === 'tshirt' ? ['White','Black','Grey'] : ['White','Black']).map(v => (
                <button key={v} onClick={() => setSelectedVariant(v)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${selectedVariant === v ? 'bg-primary text-primary-foreground border-primary' : 'hover:border-foreground'}`}>{v}</button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="text-2xl font-bold">₹{selectedProduct?.price || 999}</p>
          </div>

          <Button size="lg" className="w-full gap-2" disabled={!designFile} onClick={handleAddToCart}>
            <ShoppingCart className="h-4 w-4" /> Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
