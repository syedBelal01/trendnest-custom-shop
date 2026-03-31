import type { Product } from '@/types';

/** Variant labels for selectors: uses `variantOptions` names, else legacy `variants`. */
export function productVariantNames(product: Pick<Product, 'variants' | 'variantOptions'>): string[] {
  if (product.variantOptions?.length) {
    return product.variantOptions.map(v => v.name.trim()).filter(Boolean);
  }
  return product.variants?.filter(Boolean) ?? [];
}
