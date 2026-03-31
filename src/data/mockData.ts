import { Product, Order, Coupon, CartItem } from '@/types';

const IMG = 'https://images.unsplash.com/photo-';

/** Store catalog: leather belts, soap dispensers, printed tees & cups (+ custom print SKUs). */
export const initialProducts: Product[] = [
  {
    id: 'belt-1',
    name: 'Genuine Leather Belt',
    description: 'Full-grain leather belt with brushed metal buckle. Multiple waist sizes and leather finishes.',
    price: 899,
    originalPrice: 1299,
    images: [`${IMG}1553062407-98d43420e9e7?w=600`],
    category: 'fashion',
    subcategory: 'Belts',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
    variants: ['Black', 'Brown', 'Tan', 'Burgundy'],
    stock: 85,
    rating: 4.7,
    reviews: [{ id: 'r1', userName: 'Vikram', rating: 5, comment: 'Solid leather, great buckle.', date: '2026-02-10' }],
    isTrending: true,
    tags: ['bestseller'],
  },
  {
    id: 'soap-1',
    name: 'Soap Dispenser',
    description: 'Refillable pump dispenser for bathroom or kitchen. Premium finish options.',
    price: 499,
    originalPrice: 799,
    images: [`${IMG}1585412727339-54e4bae3cff0?w=600`],
    category: 'home',
    subcategory: 'Bath',
    variants: ['White Marble', 'Black Marble', 'Matte Silver'],
    stock: 55,
    rating: 4.4,
    reviews: [{ id: 'r2', userName: 'Sneha', rating: 4, comment: 'Looks great on the counter.', date: '2026-01-22' }],
    isTrending: true,
    tags: ['home'],
  },
  {
    id: 'tee-print-1',
    name: 'Printed T-Shirt',
    description: 'DTG printed cotton tee. Available in white, black, or gray with half or full sleeve.',
    price: 749,
    originalPrice: 999,
    images: [`${IMG}1521572163474-6864f9cf17ab?w=600`],
    category: 'printed',
    subcategory: 'Printed Tees',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: ['White', 'Black', 'Gray'],
    sleeveTypes: ['Half sleeve', 'Full sleeve'],
    stock: 200,
    rating: 4.5,
    reviews: [{ id: 'r3', userName: 'Karan', rating: 5, comment: 'Print stayed vivid after wash.', date: '2026-03-01' }],
    isTrending: true,
    tags: ['printed'],
  },
  {
    id: 'cup-print-1',
    name: 'Printed Cup',
    description: 'Ceramic cup with durable printed artwork. Microwave-safe.',
    price: 399,
    originalPrice: 599,
    images: [`${IMG}1514228742587-6b1558fcca3d?w=600`],
    category: 'printed',
    subcategory: 'Printed Cups',
    variants: ['White', 'Black'],
    stock: 130,
    rating: 4.6,
    reviews: [],
    tags: ['printed', 'gifting'],
  },
  {
    id: 'custom-tee',
    name: 'Custom Print T-Shirt',
    description: 'Upload your design — printed on premium cotton. White, black, or gray; all sizes; half or full sleeve.',
    price: 999,
    images: [`${IMG}1523381210434-271e8be1f52b?w=600`],
    category: 'printed',
    subcategory: 'Custom Print',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    variants: ['White', 'Black', 'Gray'],
    sleeveTypes: ['Half sleeve', 'Full sleeve'],
    stock: 999,
    rating: 4.5,
    reviews: [],
    isCustomPrint: true,
    tags: ['custom'],
  },
  {
    id: 'custom-cup',
    name: 'Custom Print Cup',
    description: 'Upload your artwork for a personalized ceramic cup.',
    price: 499,
    images: [`${IMG}1577937927133-4dcce3b43378?w=600`],
    category: 'printed',
    subcategory: 'Custom Print',
    variants: ['White', 'Black'],
    stock: 999,
    rating: 4.3,
    reviews: [],
    isCustomPrint: true,
    tags: ['custom', 'gifting'],
  },
];

const belt = initialProducts[0];
const tee = initialProducts[2];
const customTee = initialProducts[4];

const line = (item: Omit<CartItem, 'cartLineId'> & { cartLineId?: string }): CartItem => ({
  ...item,
  cartLineId: item.cartLineId ?? `seed-${item.product.id}-${item.selectedSize}-${item.selectedVariant}`,
});

export const initialOrders: Order[] = [
  {
    id: 'ORD001',
    items: [
      line({ product: belt, quantity: 2, selectedSize: '32', selectedVariant: 'Black' }),
    ],
    customer: { name: 'Rahul Sharma', phone: '9876543210', address: '42 MG Road, Koramangala', city: 'Bangalore', pincode: '560034' },
    status: 'pending',
    total: 1798,
    discount: 0,
    createdAt: '2026-03-28T10:30:00',
    hasCustomPrint: false,
  },
  {
    id: 'ORD002',
    items: [
      line({
        product: customTee,
        quantity: 1,
        selectedSize: 'L',
        selectedVariant: 'White',
        selectedSleeve: 'Full sleeve',
        customDesignFile: 'design.png',
        customDesignName: 'My Logo',
        customProductType: 'tshirt',
      }),
    ],
    customer: { name: 'Priya Patel', phone: '9123456780', address: '15 Park Street', city: 'Mumbai', pincode: '400001' },
    status: 'confirmed',
    total: 999,
    discount: 0,
    createdAt: '2026-03-27T14:00:00',
    hasCustomPrint: true,
  },
  {
    id: 'ORD003',
    items: [line({ product: tee, quantity: 1, selectedSize: 'M', selectedVariant: 'Gray', selectedSleeve: 'Half sleeve' })],
    customer: { name: 'Amit K.', phone: '9988776655', address: '12 Residency Road', city: 'Hyderabad', pincode: '500001' },
    status: 'shipped',
    total: 749,
    discount: 0,
    createdAt: '2026-03-25T09:00:00',
    hasCustomPrint: false,
  },
];

export const coupons: Coupon[] = [
  { id: 'c1', code: 'WELCOME10', type: 'percentage', value: 10, minOrder: 500, isActive: true, expiresAt: '2026-06-30' },
  { id: 'c2', code: 'FLAT100', type: 'flat', value: 100, minOrder: 999, isActive: true, expiresAt: '2026-04-30' },
  { id: 'c3', code: 'FREESHIP', type: 'free_delivery', value: 0, minOrder: 499, isActive: true, expiresAt: '2026-05-31' },
];

export const categories = [
  { id: 'home', name: 'Home Essentials', icon: '🏠', description: 'Soap dispensers & more', image: `${IMG}1556909114-f6e7ad7d3136?w=600` },
  { id: 'printed', name: 'Printed Products', icon: '🎨', description: 'Tees, cups & custom prints', image: `${IMG}1523381210434-271e8be1f52b?w=600` },
  { id: 'trending', name: 'Trending', icon: '🔥', description: 'Popular picks', image: `${IMG}1513506003901-1e6a229e2d15?w=600` },
];
