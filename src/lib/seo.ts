import type { Product } from '@/types';

export const SEO_BRAND_NAME = 'TrendNest99';
export const SEO_CANONICAL_BASE = 'https://trendnest99.in';

function cleanText(input: unknown): string {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const t = token.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function slugifyTokens(input: unknown): string[] {
  return cleanText(input)
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function slugifyFromTokens(tokens: string[]): string {
  return uniqTokens(tokens).join('-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

export function productLongTailKeyword(product: Pick<Product, 'name' | 'category' | 'subcategory'>): string {
  const name = cleanText(product.name);
  const category = cleanText(product.category);
  const subcategory = cleanText(product.subcategory);

  if (category === 'printed') {
    if (name.includes('cup') || name.includes('mug')) return 'custom printed cup online india';
    return 'printed t shirt online india';
  }
  if (subcategory.includes('belt') || name.includes('belt')) return 'men leather belt online india';
  if (category === 'fashion') return 'mens fashion accessories online india';
  if (category === 'home') return 'home & kitchen products online india';
  if (category === 'electronics') return 'electronics accessories online india';
  return 'online shopping india';
}

export function productSeoSlug(product: Pick<Product, 'name' | 'category' | 'subcategory'>): string {
  const raw = `${product.name || ''} ${productLongTailKeyword(product)} trendnest99`;
  const slug = slugifyFromTokens(slugifyTokens(raw).slice(0, 14));
  return slug || 'product';
}

export function productSeoPath(product: Pick<Product, 'name' | 'category' | 'subcategory'>): string {
  return `/product/${productSeoSlug(product)}`;
}

export function productCanonicalUrl(product: Pick<Product, 'name' | 'category' | 'subcategory'>): string {
  return `${SEO_CANONICAL_BASE}${productSeoPath(product)}`;
}

export function normalizeRouteProductParam(raw: unknown): string {
  return decodeURIComponent(String(raw ?? '').trim()).toLowerCase();
}

export function resolveProductFromRouteParam(
  routeParam: string | undefined,
  products: Array<Pick<Product, 'id' | 'name' | 'category' | 'subcategory'>>
): Pick<Product, 'id' | 'name' | 'category' | 'subcategory'> | undefined {
  const normalized = normalizeRouteProductParam(routeParam);
  if (!normalized) return undefined;
  const byId = products.find((p) => String(p.id).trim().toLowerCase() === normalized);
  if (byId) return byId;
  return products.find((p) => productSeoSlug(p) === normalized);
}

export function productImageAlt(
  product: Pick<Product, 'name' | 'category' | 'subcategory'>,
  context = 'product image'
): string {
  const keyword = productLongTailKeyword(product);
  return `${product.name} ${keyword} ${SEO_BRAND_NAME} ${context}`.replace(/\s+/g, ' ').trim();
}

export function ensureSeoMetaDescription(text: string, min = 150, max = 160): string {
  const cleaned = String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length > max) return `${cleaned.slice(0, max - 1).trimEnd()}...`;
  if (cleaned.length >= min) return cleaned;
  return `${cleaned} Shop online in India with ${SEO_BRAND_NAME}.`.slice(0, max).trimEnd();
}

export function buildProductSeoParagraph(product: Pick<Product, 'name' | 'description' | 'category' | 'subcategory'>): string {
  const keyword = productLongTailKeyword(product);
  const shortDesc = String(product.description || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sentenceA = `${product.name} is one of the most practical choices for shoppers looking for ${keyword}.`;
  const sentenceB = shortDesc
    ? `It offers ${shortDesc.toLowerCase().replace(/\.$/, '')}, making it suitable for everyday use and gifting.`
    : `This product is selected to deliver reliable quality, good finish, and everyday comfort for Indian buyers.`;
  const sentenceC = `From fit and material to value pricing, this item is designed for customers who want style and utility without compromise.`;
  const sentenceD = `If you are comparing options for ${keyword}, this listing helps you buy confidently with clear details, secure checkout, and delivery support.`;
  const sentenceE = `Explore more related products on ${SEO_BRAND_NAME} to build a complete cart with matching essentials.`;
  const text = `${sentenceA} ${sentenceB} ${sentenceC} ${sentenceD} ${sentenceE}`;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 150 && words.length >= 100) return text;
  if (words.length > 150) return words.slice(0, 140).join(' ') + '.';
  return `${text} Customers also discover this product through long-tail searches because the design, utility, and price range fit real purchase intent.`;
}
