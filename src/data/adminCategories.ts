import type { ProductCategory } from '@/types';

export type AdminCategoryTree = Record<ProductCategory, string[]>;

/**
 * Main category → allowed subcategories for the admin wizard.
 * Keep this as a single source of truth so adding categories later is easy.
 */
export const ADMIN_CATEGORY_TREE: AdminCategoryTree = {
  fashion: ['Belts', 'Shirts', 'T-Shirts', 'Jeans', 'Shoes', 'Accessories'],
  home: ['Shop Dispenser', 'Furniture', 'Bath', 'Kitchen', 'Decor'],
  electronics: ['Mobiles', 'Headphones', 'Chargers', 'Smart Watches', 'Accessories'],
  printed: ['Printed Tees', 'Printed Cups', 'Custom Print'],
  trending: ['Trending'],
};

export const ADMIN_MAIN_CATEGORIES: Array<{ id: ProductCategory; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'printed', label: 'Printed' },
  { id: 'trending', label: 'Trending' },
];

