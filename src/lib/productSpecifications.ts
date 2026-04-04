import type { Product, ProductSpecification } from '@/types';

/** Parse specifications from API / context; tolerates missing array or odd row shapes. */
export function parseProductSpecifications(product: Product): ProductSpecification[] {
  const raw = (product as { specifications?: unknown }).specifications;
  if (!Array.isArray(raw)) return [];
  const out: ProductSpecification[] = [];
  for (const row of raw) {
    if (row == null || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const label = String(
      o.label ?? o.key ?? o.name ?? (o as { Label?: unknown }).Label ?? ''
    ).trim();
    const value = String(o.value ?? (o as { Value?: unknown }).Value ?? '').trim();
    if (label.length > 0 && value.length > 0) out.push({ label, value });
  }
  return out;
}
