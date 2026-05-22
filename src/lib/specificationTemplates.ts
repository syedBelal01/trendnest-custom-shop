import type { ProductCategory, ProductSpecification } from '@/types';

const DEFAULT_SPECIFICATION_LABELS = [
  'Brand',
  'Material',
  'Color',
  'Size',
  'Net Quantity',
  'Ideal For',
  'Usage',
  'Country of Origin',
];

const CATEGORY_SPECIFICATION_LABELS: Partial<Record<ProductCategory, string[]>> = {
  fashion: [
    'Brand',
    'Fabric',
    'Fit',
    'Sleeve',
    'Pattern',
    'Neck Type',
    'Size',
    'Color',
    'Ideal For',
    'Occasion',
    'Wash Care',
    'Country of Origin',
  ],
  printed: [
    'Brand',
    'Fabric',
    'Fit',
    'Sleeve',
    'Pattern',
    'Neck Type',
    'Size',
    'Color',
    'Ideal For',
    'Occasion',
    'Wash Care',
    'Country of Origin',
  ],
  home: [
    'Brand',
    'Material',
    'Color',
    'Capacity',
    'Dimensions',
    'Finish Type',
    'Usage',
    'Included Components',
    'Net Quantity',
    'Country of Origin',
  ],
  kitchen: [
    'Brand',
    'Material',
    'Color',
    'Capacity',
    'Dimensions',
    'Finish Type',
    'Usage',
    'Included Components',
    'Net Quantity',
    'Country of Origin',
  ],
  electronics: [
    'Brand',
    'Model',
    'Power Source',
    'Voltage',
    'Warranty',
    'Material',
    'Color',
    'Included Components',
    'Country of Origin',
  ],
  'car-motorbike': [
    'Brand',
    'Model',
    'Compatibility',
    'Material',
    'Color',
    'Dimensions',
    'Included Components',
    'Warranty',
    'Country of Origin',
  ],
  jewellery: ['Brand', 'Material', 'Color', 'Plating', 'Occasion', 'Size', 'Net Quantity', 'Country of Origin'],
  gifts: ['Brand', 'Material', 'Color', 'Occasion', 'Usage', 'Included Components', 'Net Quantity', 'Country of Origin'],
  gardening: ['Brand', 'Material', 'Color', 'Capacity', 'Dimensions', 'Usage', 'Included Components', 'Country of Origin'],
  'kids-baby': ['Brand', 'Material', 'Color', 'Age Group', 'Ideal For', 'Usage', 'Wash Care', 'Country of Origin'],
  'health-beauty': ['Brand', 'Material', 'Color', 'Skin Type', 'Ideal For', 'Usage', 'Net Quantity', 'Country of Origin'],
};

const SUBCATEGORY_SPECIFICATION_LABELS: Record<string, string[]> = {
  't-shirt': CATEGORY_SPECIFICATION_LABELS.fashion!,
  't-shirts': CATEGORY_SPECIFICATION_LABELS.fashion!,
  'printed tees': CATEGORY_SPECIFICATION_LABELS.fashion!,
  'printed tee': CATEGORY_SPECIFICATION_LABELS.fashion!,
  pillow: [
    'Brand',
    'Product Type',
    'Material',
    'Color',
    'Shape',
    'Filling Material',
    'Washable',
    'Ideal For',
    'Usage',
    'Special Feature',
    'Lightweight',
    'Skin Friendly',
    'Country of Origin',
  ],
};

export function normalizeSpecLabel(label: unknown): string {
  const normalized = String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (normalized === 'brand name') return 'brand';
  if (normalized === 'product name') return 'name';
  return normalized;
}

export function getSuggestedSpecificationLabels(
  category?: ProductCategory | string,
  subcategory?: string
): string[] {
  const normalizedSubcategory = normalizeSpecLabel(subcategory);
  const subcategoryLabels = normalizedSubcategory ? SUBCATEGORY_SPECIFICATION_LABELS[normalizedSubcategory] : undefined;
  if (subcategoryLabels?.length) return [...subcategoryLabels];
  if (normalizedSubcategory.includes('pillow')) return [...SUBCATEGORY_SPECIFICATION_LABELS.pillow];
  if (normalizedSubcategory.includes('t-shirt') || normalizedSubcategory.includes('tshirt') || normalizedSubcategory.includes('tee')) {
    return [...CATEGORY_SPECIFICATION_LABELS.fashion!];
  }

  const normalizedCategory = String(category ?? '').trim() as ProductCategory;
  return [...(CATEGORY_SPECIFICATION_LABELS[normalizedCategory] ?? DEFAULT_SPECIFICATION_LABELS)];
}

function cleanImportedLine(raw: string): string {
  return raw
    .replace(/^[\s\u2022*\u2013\u2014-]+/, '')
    .replace(/^\d+[.)]\s*/, '')
    .trim();
}

function cleanImportedLabel(raw: string): string {
  const label = cleanImportedLine(raw).replace(/\s+/g, ' ').trim();
  if (normalizeSpecLabel(label) === 'brand name') return 'Brand';
  return label;
}

const IMPORT_LABELS_TO_SKIP = new Set([
  'name',
  'product name',
  'title',
  'description',
  'key features',
  'specifications',
]);

export function parseSpecificationText(raw: string): ProductSpecification[] {
  const rows: ProductSpecification[] = [];
  const seen = new Set<string>();

  for (const line of String(raw ?? '').split(/\r?\n/)) {
    const cleaned = cleanImportedLine(line);
    if (!cleaned) continue;

    const colonIndex = cleaned.indexOf(':');
    if (colonIndex <= 0) continue;

    const label = cleanImportedLabel(cleaned.slice(0, colonIndex));
    const value = cleaned.slice(colonIndex + 1).trim();
    const normalized = normalizeSpecLabel(label);

    if (!label || !value || IMPORT_LABELS_TO_SKIP.has(normalized) || normalized.startsWith('key features') || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    rows.push({ label, value });
  }

  return rows;
}

export function mergeSpecificationsWithImportedText(
  existingSpecs: Array<Partial<ProductSpecification>> | undefined,
  raw: string
): ProductSpecification[] {
  const rows = Array.isArray(existingSpecs)
    ? existingSpecs.map((spec) => ({
        label: String(spec?.label ?? ''),
        value: String(spec?.value ?? ''),
      }))
    : [];
  const imported = parseSpecificationText(raw);

  for (const spec of imported) {
    const normalized = normalizeSpecLabel(spec.label);
    const existingIndex = rows.findIndex((row) => normalizeSpecLabel(row.label) === normalized);
    if (existingIndex >= 0) {
      if (!String(rows[existingIndex].value ?? '').trim()) {
        rows[existingIndex] = { ...rows[existingIndex], value: spec.value };
      }
      continue;
    }
    rows.push(spec);
  }

  return rows;
}

export function mergeSpecificationsWithTemplate(
  existingSpecs: Array<Partial<ProductSpecification>> | undefined,
  category?: ProductCategory | string,
  subcategory?: string
): ProductSpecification[] {
  const rows = Array.isArray(existingSpecs)
    ? existingSpecs.map((spec) => ({
        label: String(spec?.label ?? ''),
        value: String(spec?.value ?? ''),
      }))
    : [];
  const seen = new Set(rows.map((spec) => normalizeSpecLabel(spec.label)).filter(Boolean));
  const missing = getSuggestedSpecificationLabels(category, subcategory)
    .filter((label) => !seen.has(normalizeSpecLabel(label)))
    .map((label) => ({ label, value: '' }));

  return [...rows, ...missing];
}
