export type CustomProductType = 'tshirt' | 'mug';

export type PrintAreaPct = {
  /** 0..100 */
  leftPct: number;
  /** 0..100 */
  topPct: number;
  /** 0..100 */
  widthPct: number;
  /** 0..100 */
  heightPct: number;
};

export type MockupEntry = {
  mockupUrl: string;
  printArea: PrintAreaPct;
};

/**
 * v1: fixed-position preview areas (no drag/resize).
 * Percent-based so the overlay stays consistent on mobile.
 *
 * NOTE: These mockup URLs are placeholders. Replace mockupUrl values with your real
 * clean mockup images for each variant/style as you add them.
 */
export const CUSTOM_PRINT_MOCKUPS: Record<
  CustomProductType,
  Record<string /* color */, Record<string /* style */, MockupEntry>>
> = {
  tshirt: {
    // Color -> Sleeve/style
    White: {
      'Half sleeve': {
        mockupUrl: 'https://res.cloudinary.com/diclcqwnm/image/upload/v1776939358/half_white_fidw20.webp',
        printArea: { leftPct: 32, topPct: 28, widthPct: 36, heightPct: 42 },
      },
      'Full sleeve': {
        mockupUrl: 'https://res.cloudinary.com/diclcqwnm/image/upload/v1776939597/full_white_kklaty.jpg',
        printArea: { leftPct: 32, topPct: 28, widthPct: 36, heightPct: 42 },
      },
    },
    Black: {
      'Half sleeve': {
        mockupUrl: 'https://res.cloudinary.com/diclcqwnm/image/upload/v1776939716/black_half_wy4wsv.webp',
        printArea: { leftPct: 32, topPct: 28, widthPct: 36, heightPct: 42 },
      },
      'Full sleeve': {
        mockupUrl: 'https://res.cloudinary.com/diclcqwnm/image/upload/v1776939717/black_full_rmj797.jpg',
        printArea: { leftPct: 32, topPct: 28, widthPct: 36, heightPct: 42 },
      },
    },
  },
  mug: {
    White: {
      Default: {
        mockupUrl: '',
        // Centered on mug body area.
        printArea: { leftPct: 28, topPct: 32, widthPct: 44, heightPct: 36 },
      },
    },
    Black: {
      Default: {
        mockupUrl: '',
        printArea: { leftPct: 28, topPct: 32, widthPct: 44, heightPct: 36 },
      },
    },
  },
};

export function resolveCustomPrintMockup(args: {
  productType: CustomProductType;
  color: string;
  style: string;
  fallbackMockupUrl: string;
}): { mockupUrl: string; printArea: PrintAreaPct } {
  const type = args.productType;
  const color = String(args.color || '').trim();
  const style = String(args.style || '').trim();
  const fallback = String(args.fallbackMockupUrl || '').trim();

  const byType = CUSTOM_PRINT_MOCKUPS[type] || {};
  const byColor = (byType[color] || byType[color.toLowerCase()] || null) as Record<string, MockupEntry> | null;
  const entry =
    (byColor && (byColor[style] || byColor[style.toLowerCase()] || byColor.Default)) ||
    (byType.White && (byType.White[style] || byType.White.Default)) ||
    null;

  const mockupUrl = String(entry?.mockupUrl || '').trim() || fallback;
  const printArea =
    entry?.printArea ||
    (type === 'mug'
      ? { leftPct: 28, topPct: 32, widthPct: 44, heightPct: 36 }
      : { leftPct: 32, topPct: 28, widthPct: 36, heightPct: 42 });

  return { mockupUrl, printArea };
}

