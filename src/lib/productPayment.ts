import type { Product } from '@/types';

export type ProductPaymentMode = 'both' | 'online' | 'cod';
export type CheckoutPaymentMethod = 'cod' | 'razorpay';

export function normalizeProductPaymentMode(raw: unknown): ProductPaymentMode {
  const mode = String(raw || '').trim().toLowerCase();
  if (mode === 'online' || mode === 'cod' || mode === 'both') return mode;
  return 'both';
}

export function productAllowsPaymentMethod(product: Pick<Product, 'paymentMode'> | null | undefined, method: CheckoutPaymentMethod): boolean {
  const mode = normalizeProductPaymentMode(product?.paymentMode);
  if (mode === 'both') return true;
  if (mode === 'online') return method === 'razorpay';
  return method === 'cod';
}

export function effectivePaymentMethodForProduct(
  product: Pick<Product, 'paymentMode'> | null | undefined,
  preferred: CheckoutPaymentMethod = 'cod'
): CheckoutPaymentMethod {
  if (productAllowsPaymentMethod(product, preferred)) return preferred;
  return productAllowsPaymentMethod(product, 'razorpay') ? 'razorpay' : 'cod';
}

export function productUnitPriceForPaymentMethod(
  product: Product,
  method: CheckoutPaymentMethod,
  selectedVariant?: string
): number {
  const p = product as any;
  const variantKey = selectedVariant ? String(selectedVariant) : defaultVariantKey(product) ?? '';
  if (p?.variantModel?.items?.length && variantKey) {
    const hit = p.variantModel.items.find((x: any) => String(x?.key) === variantKey);
    if (hit) {
      const n =
        method === 'razorpay'
          ? (hit.onlinePrice != null ? Number(hit.onlinePrice) : Number(hit.price))
          : (hit.codPrice != null ? Number(hit.codPrice) : Number(hit.price));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }
  }
  const n =
    method === 'razorpay'
      ? (p.onlinePrice != null ? Number(p.onlinePrice) : Number(p.price))
      : (p.codPrice != null ? Number(p.codPrice) : Number(p.price));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function productDisplayPrice(
  product: Product,
  preferred: CheckoutPaymentMethod = 'cod',
  selectedVariant?: string
): number {
  return productUnitPriceForPaymentMethod(product, effectivePaymentMethodForProduct(product, preferred), selectedVariant);
}

export function productDiscountPercent(product: Product, displayPrice: number): number {
  const mrp = Number(product.originalPrice);
  if (!Number.isFinite(mrp) || mrp <= 0 || mrp <= displayPrice) return 0;
  return Math.round(((mrp - displayPrice) / mrp) * 100);
}

export function paymentModeLabel(mode: ProductPaymentMode): string {
  if (mode === 'online') return 'Online payment only';
  if (mode === 'cod') return 'COD only';
  return 'COD and online payment';
}

type VariantModel = NonNullable<Product['variantModel']>;

/** Resolve the storefront default variant key when none is selected. */
export function defaultVariantKey(product: Pick<Product, 'variantModel'>): string | undefined {
  const items = product.variantModel?.items;
  if (!items?.length) return undefined;
  const def = items.find((it) => it.isDefault) ?? items[0];
  return def?.key != null ? String(def.key) : undefined;
}

/**
 * When admin edits root price fields, mirror them onto the default variant row.
 * Storefront checkout uses variant-level prices when variantModel exists.
 */
export function syncRootPricesToDefaultVariant(
  variantModel: VariantModel | undefined,
  root: { price?: number; onlinePrice?: number; originalPrice?: number }
): VariantModel | undefined {
  if (!variantModel?.items?.length) return variantModel;
  const items = variantModel.items;
  const cod = root.price != null && Number.isFinite(Number(root.price)) ? Number(root.price) : undefined;
  const online =
    root.onlinePrice != null && Number.isFinite(Number(root.onlinePrice))
      ? Number(root.onlinePrice)
      : cod;
  const mrp =
    root.originalPrice != null && Number.isFinite(Number(root.originalPrice))
      ? Number(root.originalPrice)
      : undefined;

  return {
    ...variantModel,
    items: items.map((it, idx) => {
      const isTarget = items.length === 1 || it.isDefault || idx === 0;
      if (!isTarget) return it;
      return {
        ...it,
        ...(cod !== undefined ? { price: cod, codPrice: cod } : {}),
        ...(online !== undefined ? { onlinePrice: online } : {}),
        ...(mrp !== undefined ? { originalPrice: mrp } : {}),
      };
    }),
  };
}
