import type { ProductCategory } from '@/types';

export type AdminCategoryTree = Record<ProductCategory, string[]>;

/**
 * Main category → allowed subcategories for the admin wizard.
 * Keep this as a single source of truth so adding categories later is easy.
 */
export const ADMIN_CATEGORY_TREE: AdminCategoryTree = {
  'new-arrivals': ['New Arrivals'],
  summer: ['Summer Collection 2026'],
  'deal-of-the-day': ['Bestsellers', 'Limited Deals'],
  kitchen: ['Kitchen Essentials', 'Storage', 'Tools', 'Dining'],
  'car-motorbike': ['Car Accessories', 'Motorbike Accessories', 'Cleaning', 'Tools'],
  gardening: ['Gardening Tools', 'Planters', 'Watering', 'Outdoor'],
  jewellery: ['Jewellery', 'Necklaces', 'Bracelets', 'Rings', 'Earrings'],
  gifts: ['Gifts', 'Personalized Gifts', 'Festive Gifts'],
  fashion: ['Belts', 'Shirts', 'T-Shirts', 'Jeans', 'Shoes', 'Accessories'],
  home: ['Soap Dispenser', 'Furniture', 'Bath', 'Kitchen', 'Decor'],
  electronics: ['Mobiles', 'Headphones', 'Chargers', 'Smart Watches', 'Accessories'],
  'kids-baby': ['Kids Essentials', 'Baby Essentials', 'Toys', 'Care'],
  'health-beauty': ['Health Essentials', 'Beauty Essentials', 'Personal Care', 'Skincare'],
  printed: ['Printed Tees', 'Printed Cups', 'Custom Print'],
  trending: ['Trending'],
};

export const ADMIN_MAIN_CATEGORIES: Array<{ id: ProductCategory; label: string }> = [
  { id: 'new-arrivals', label: 'New Arrivals' },
  { id: 'summer', label: 'Summer' },
  { id: 'deal-of-the-day', label: 'Deal of the Day' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'car-motorbike', label: 'Car & Motorbike' },
  { id: 'gardening', label: 'Gardening' },
  { id: 'jewellery', label: 'Jewellery' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'home', label: 'Home Essentials' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'kids-baby', label: 'Kids & Baby' },
  { id: 'health-beauty', label: 'Health & Beauty' },
  { id: 'printed', label: 'Printed' },
  { id: 'trending', label: 'Trending' },
];

