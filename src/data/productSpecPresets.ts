import type { ProductCategory } from '@/types';

/** Suggested specification labels per storefront category (admin can add/remove freely). */
export const PRODUCT_SPEC_LABEL_PRESETS: Record<ProductCategory, string[]> = {
  fashion: ['Brand', 'Material', 'Fit', 'Care instructions', 'Country of origin', 'Dimensions'],
  home: ['Material', 'Dimensions', 'Weight', 'Color', 'Warranty', 'Country of origin'],
  printed: ['Brand', 'Material', 'Print type', 'Care instructions', 'Capacity', 'Dimensions'],
  trending: ['Brand', 'Material', 'Weight', 'Dimensions', 'Country of origin', 'Warranty'],
};

export function suggestedSpecLabelsForCategory(category: ProductCategory): string[] {
  return [...(PRODUCT_SPEC_LABEL_PRESETS[category] ?? PRODUCT_SPEC_LABEL_PRESETS.fashion)];
}
