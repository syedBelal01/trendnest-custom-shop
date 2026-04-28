import type { Product } from '@/types';
import { productVariantNames } from '@/lib/productVariants';

const PLACEHOLDER = '/placeholder.svg';

function firstUrlInList(list: string[] | undefined): string | undefined {
  const u = list?.map(s => s.trim()).filter(Boolean)[0];
  return u;
}

/** Card / list thumbnail: first image from first variant option that has images, else `product.images`. */
export function productPrimaryImage(product: Pick<Product, 'images' | 'variantOptions'>): string {
  const root = firstUrlInList(product.images);
  if (root) return root;
  const opts = product.variantOptions?.filter(v => v.name?.trim());
  if (opts?.length) {
    for (const o of opts) {
      const u = firstUrlInList(o.images);
      if (u) return u;
    }
  }
  return PLACEHOLDER;
}

/** Cart line: image for the chosen variant when using `variantOptions`. */
export function productImageForVariant(
  product: Pick<Product, 'images' | 'variantOptions'>,
  selectedVariant?: string
): string {
  if (product.variantOptions?.length && selectedVariant) {
    const m = product.variantOptions.find(v => v.name.trim() === selectedVariant.trim());
    const u = firstUrlInList(m?.images);
    if (u) return u;
  }
  return productPrimaryImage(product);
}

/** PDP gallery URLs for the current variant (or legacy `images`). */
export function galleryImagesForSelection(
  product: Product,
  selectedVariant: string
): string[] {
  const root = (product.images ?? []).map(s => s.trim()).filter(Boolean);
  if (product.variantOptions?.length) {
    const names = productVariantNames(product);
    const effective =
      names.includes(selectedVariant) && selectedVariant
        ? selectedVariant
        : names[0] || '';
    const opt = product.variantOptions.find(v => v.name.trim() === effective.trim());
    const fromVariant = (opt?.images ?? []).map(s => s.trim()).filter(Boolean);
    if (fromVariant.length) {
      // Root images are still included so admin updates to product.images always reflect on the storefront.
      return [...fromVariant, ...root].filter((u, i, arr) => arr.indexOf(u) === i);
    }
  }
  return root;
}
