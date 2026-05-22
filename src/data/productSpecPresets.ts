import type { ProductCategory } from '@/types';
import { getSuggestedSpecificationLabels } from '@/lib/specificationTemplates';

/** Backward-compatible wrapper for older admin imports. */
export function suggestedSpecLabelsForCategory(category: ProductCategory): string[] {
  return getSuggestedSpecificationLabels(category);
}
