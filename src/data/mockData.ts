import { Product, Order, Coupon } from '@/types';

const IMG = 'https://images.unsplash.com/photo-';

export const products: Product[] = [
  // Fashion - T-shirts
  { id: 'f1', name: 'Classic Black Tee', description: 'Premium cotton crew-neck t-shirt. Soft, breathable fabric perfect for everyday wear.', price: 599, originalPrice: 999, images: [`${IMG}1521572163474-6864f9cf17ab?w=600`], category: 'fashion', subcategory: 'T-shirts', sizes: ['S','M','L','XL'], variants: ['Black','White','Navy'], stock: 50, rating: 4.5, reviews: [{id:'r1',userName:'Rahul',rating:5,comment:'Great quality!',date:'2025-12-01'}], isTrending: true, tags: ['bestseller'] },
  { id: 'f2', name: 'Oversized Streetwear Tee', description: 'Trendy oversized fit with drop shoulders. Urban style statement.', price: 799, originalPrice: 1299, images: [`${IMG}1583743814966-8936f5b7be1a?w=600`], category: 'fashion', subcategory: 'T-shirts', sizes: ['M','L','XL','XXL'], variants: ['Grey','Olive','Beige'], stock: 35, rating: 4.3, reviews: [{id:'r2',userName:'Priya',rating:4,comment:'Love the fit!',date:'2025-11-15'}], isTrending: true, tags: ['trending'] },
  { id: 'f3', name: 'Graphic Print Tee', description: 'Bold graphic print on premium cotton. Stand out from the crowd.', price: 699, images: [`${IMG}1576566588028-4147f3842f27?w=600`], category: 'fashion', subcategory: 'T-shirts', sizes: ['S','M','L','XL'], variants: ['White','Black'], stock: 40, rating: 4.1, reviews: [], tags: [] },
  // Fashion - Shirts
  { id: 'f4', name: 'Slim Fit Oxford Shirt', description: 'Classic oxford cotton shirt with a modern slim fit. Perfect for office or casual outings.', price: 1299, originalPrice: 1999, images: [`${IMG}1596755094514-f87e34085b2c?w=600`], category: 'fashion', subcategory: 'Shirts', sizes: ['S','M','L','XL'], variants: ['White','Light Blue','Pink'], stock: 25, rating: 4.6, reviews: [{id:'r3',userName:'Amit',rating:5,comment:'Perfect fit!',date:'2025-10-20'}], tags: ['premium'] },
  { id: 'f5', name: 'Casual Linen Shirt', description: 'Breathable linen shirt for summer days. Relaxed fit with rolled-up sleeves.', price: 1499, images: [`${IMG}1602810318383-e386cc2a3ccf?w=600`], category: 'fashion', subcategory: 'Shirts', sizes: ['M','L','XL'], variants: ['Beige','Sky Blue'], stock: 20, rating: 4.4, reviews: [], tags: [] },
  // Fashion - Belts
  { id: 'f6', name: 'Leather Classic Belt', description: 'Genuine leather belt with brushed metal buckle. Timeless accessory.', price: 899, originalPrice: 1499, images: [`${IMG}1553062407-98d43420e9e7?w=600`], category: 'fashion', subcategory: 'Belts', sizes: ['30','32','34','36','38'], variants: ['Brown','Black'], stock: 30, rating: 4.7, reviews: [{id:'r4',userName:'Vikram',rating:5,comment:'Excellent quality leather',date:'2025-09-10'}], isTrending: true, tags: ['bestseller'] },
  // Home Essentials
  { id: 'h1', name: 'Marble Soap Dispenser', description: 'Elegant marble-finish soap dispenser for bathroom or kitchen. Pump mechanism for easy use.', price: 499, originalPrice: 799, images: [`${IMG}1585412727339-54e4bae3cff0?w=600`], category: 'home', subcategory: 'Bath', variants: ['White Marble','Black Marble'], stock: 45, rating: 4.3, reviews: [{id:'r5',userName:'Sneha',rating:4,comment:'Looks great in my bathroom',date:'2025-11-05'}], isTrending: true, tags: ['trending'] },
  { id: 'h2', name: 'Bamboo Organizer Set', description: 'Eco-friendly bamboo organizer for desk or vanity. 3-compartment design.', price: 699, images: [`${IMG}1595428774223-ef52624120d2?w=600`], category: 'home', subcategory: 'Organization', stock: 30, rating: 4.5, reviews: [], tags: ['eco'] },
  { id: 'h3', name: 'Scented Candle Collection', description: 'Set of 3 premium scented candles. Lavender, Vanilla, and Ocean Breeze.', price: 899, originalPrice: 1299, images: [`${IMG}1602607663858-bc52c0b1dcf5?w=600`], category: 'home', subcategory: 'Decor', stock: 25, rating: 4.8, reviews: [{id:'r6',userName:'Meera',rating:5,comment:'Amazing fragrance!',date:'2025-12-10'}], tags: ['gifting'] },
  { id: 'h4', name: 'Ceramic Planter Pot', description: 'Handcrafted ceramic planter in minimalist design. Perfect for indoor plants.', price: 399, images: [`${IMG}1485955900006-d5666d8b19da?w=600`], category: 'home', subcategory: 'Decor', stock: 60, rating: 4.2, reviews: [], tags: [] },
  // Printed Products - Ready-made
  { id: 'p1', name: 'Motivational Quote Tee', description: 'Printed t-shirt with inspirational typography. Premium DTG printing.', price: 799, images: [`${IMG}1529374255404-311a2a4f3fd1?w=600`], category: 'printed', subcategory: 'Ready Designs', sizes: ['S','M','L','XL'], variants: ['White','Black'], stock: 40, rating: 4.4, reviews: [{id:'r7',userName:'Karan',rating:4,comment:'Print quality is good',date:'2025-11-20'}], tags: ['popular'] },
  { id: 'p2', name: 'Abstract Art Mug', description: 'Ceramic mug with vibrant abstract art print. Microwave and dishwasher safe.', price: 399, originalPrice: 599, images: [`${IMG}1514228742587-6b1558fcca3d?w=600`], category: 'printed', subcategory: 'Ready Designs', variants: ['Design A','Design B'], stock: 50, rating: 4.6, reviews: [], isTrending: true, tags: ['trending'] },
  { id: 'p3', name: 'Custom Print T-shirt', description: 'Upload your own design and get it printed on a premium cotton t-shirt.', price: 999, images: [`${IMG}1523381210434-271e8be1f52b?w=600`], category: 'printed', subcategory: 'Custom Print', sizes: ['S','M','L','XL','XXL'], variants: ['White','Black','Grey'], stock: 100, rating: 4.5, reviews: [], isCustomPrint: true, tags: ['custom'] },
  { id: 'p4', name: 'Custom Print Mug', description: 'Upload your design for a personalized ceramic mug. Great for gifts!', price: 499, images: [`${IMG}1577937927133-4dcce3b43378?w=600`], category: 'printed', subcategory: 'Custom Print', variants: ['White','Black'], stock: 100, rating: 4.3, reviews: [], isCustomPrint: true, tags: ['custom','gifting'] },
  // Trending
  { id: 't1', name: 'Viral Minimalist Watch', description: 'The watch everyone is talking about. Ultra-thin design with Japanese movement.', price: 1999, originalPrice: 3999, images: [`${IMG}1524805444758-089113d48a6d?w=600`], category: 'trending', subcategory: 'Accessories', variants: ['Silver','Gold','Rose Gold'], stock: 15, rating: 4.9, reviews: [{id:'r8',userName:'Arjun',rating:5,comment:'Worth every rupee!',date:'2025-12-15'}], isTrending: true, tags: ['viral','bestseller'] },
  { id: 't2', name: 'LED Sunset Lamp', description: 'TikTok-famous sunset projection lamp. Create aesthetic room vibes instantly.', price: 799, originalPrice: 1499, images: [`${IMG}1513506003901-1e6a229e2d15?w=600`], category: 'trending', subcategory: 'Decor', stock: 20, rating: 4.7, reviews: [{id:'r9',userName:'Divya',rating:5,comment:'My room looks amazing now!',date:'2025-12-08'}], isTrending: true, tags: ['viral','trending'] },
];

export const coupons: Coupon[] = [
  { id: 'c1', code: 'WELCOME10', type: 'percentage', value: 10, minOrder: 500, isActive: true, expiresAt: '2026-06-30' },
  { id: 'c2', code: 'FLAT100', type: 'flat', value: 100, minOrder: 999, isActive: true, expiresAt: '2026-04-30' },
  { id: 'c3', code: 'FREESHIP', type: 'free_delivery', value: 0, minOrder: 499, isActive: true, expiresAt: '2026-05-31' },
];

export const sampleOrders: Order[] = [
  {
    id: 'ORD001', items: [{ product: products[0], quantity: 2, selectedSize: 'M', selectedVariant: 'Black' }],
    customer: { name: 'Rahul Sharma', phone: '9876543210', address: '42 MG Road, Koramangala', city: 'Bangalore', pincode: '560034' },
    status: 'pending', total: 1198, discount: 0, createdAt: '2026-03-28T10:30:00', hasCustomPrint: false,
  },
  {
    id: 'ORD002', items: [{ product: products[12], quantity: 1, selectedSize: 'L', selectedVariant: 'White', customDesignFile: 'design.png', customDesignName: 'My Logo', customProductType: 'tshirt' }],
    customer: { name: 'Priya Patel', phone: '9123456780', address: '15 Park Street', city: 'Mumbai', pincode: '400001' },
    status: 'confirmed', total: 999, discount: 0, createdAt: '2026-03-27T14:00:00', hasCustomPrint: true,
  },
];

export const categories = [
  { id: 'fashion', name: 'Fashion', icon: '👔', description: 'T-shirts, Shirts & Belts', image: `${IMG}1441986300917-64674bd600d8?w=600` },
  { id: 'home', name: 'Home Essentials', icon: '🏠', description: 'Soap dispensers & more', image: `${IMG}1556909114-f6e7ad7d3136?w=600` },
  { id: 'printed', name: 'Printed Products', icon: '🎨', description: 'Ready-made & custom prints', image: `${IMG}1523381210434-271e8be1f52b?w=600` },
  { id: 'trending', name: 'Trending', icon: '🔥', description: 'Viral & high-demand', image: `${IMG}1513506003901-1e6a229e2d15?w=600` },
];
