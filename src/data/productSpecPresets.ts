import type { ProductCategory } from '@/types';

/** Suggested specification labels per storefront category (admin can add/remove freely). */
export const PRODUCT_SPEC_LABEL_PRESETS: Record<ProductCategory, string[]> = {
  'new-arrivals': ['Brand', 'Material', 'Dimensions', 'Weight', 'Country of origin', 'Warranty'],
  summer: ['Brand', 'Material', 'Care instructions', 'Color', 'Dimensions', 'Country of origin'],
  'deal-of-the-day': ['Brand', 'Material', 'Dimensions', 'Weight', 'Country of origin', 'Warranty'],
  kitchen: ['Material', 'Dimensions', 'Capacity', 'Color', 'Care instructions', 'Country of origin'],
  'car-motorbike': ['Brand', 'Compatibility', 'Material', 'Dimensions', 'Warranty', 'Country of origin'],
  gardening: ['Material', 'Dimensions', 'Weight', 'Use case', 'Care instructions', 'Country of origin'],
  jewellery: ['Brand', 'Material', 'Plating', 'Care instructions', 'Dimensions', 'Country of origin'],
  gifts: ['Brand', 'Material', 'Occasion', 'Dimensions', 'Care instructions', 'Country of origin'],
  fashion: ['Brand', 'Material', 'Fit', 'Care instructions', 'Country of origin', 'Dimensions'],
  home: ['Material', 'Dimensions', 'Weight', 'Color', 'Warranty', 'Country of origin'],
  electronics: ['Brand', 'Model', 'Warranty', 'Power', 'Dimensions', 'Country of origin'],
  'kids-baby': ['Brand', 'Material', 'Age range', 'Dimensions', 'Care instructions', 'Country of origin'],
  'health-beauty': ['Brand', 'Ingredients', 'Skin type', 'Net quantity', 'Expiry', 'Country of origin'],
  printed: ['Brand', 'Material', 'Print type', 'Care instructions', 'Capacity', 'Dimensions'],
  trending: ['Brand', 'Material', 'Weight', 'Dimensions', 'Country of origin', 'Warranty'],
};

export function suggestedSpecLabelsForCategory(category: ProductCategory): string[] {
  return [...(PRODUCT_SPEC_LABEL_PRESETS[category] ?? PRODUCT_SPEC_LABEL_PRESETS.fashion)];
}
