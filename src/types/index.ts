/** Color/finish (etc.) with its own image set for PDP gallery. */
export interface ProductVariantOption {
  name: string;
  images: string[];
}

export type ProductCategory = 'fashion' | 'home' | 'electronics' | 'printed' | 'trending';

/** Admin-managed key/value rows shown under Product details on the PDP. */
export interface ProductSpecification {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: ProductCategory;
  subcategory?: string;
  sizes?: string[];
  /**
   * When set, each option has its own `images`; PDP switches gallery by selected variant.
   * `variants` is still stored as names for compatibility (derived on save).
   */
  variantOptions?: ProductVariantOption[];
  variants?: string[];
  /** Half / full sleeve options for T-shirts (printed or custom). */
  sleeveTypes?: string[];
  stock: number;
  rating: number;
  reviews: Review[];
  isCustomPrint?: boolean;
  isTrending?: boolean;
  tags?: string[];
  specifications?: ProductSpecification[];
  /** Optional per-product SKU (simple products). */
  sku?: string;
  /** Optional price used for online payment offers (simple products or default for variantModel). */
  onlinePrice?: number;
  /** Optional price used for Cash on Delivery offers. */
  codPrice?: number;
  /** Variant combinations model (new). Storefront prefers this when present. */
  variantModel?: {
    types: Array<{ name: string; values: string[] }>;
    items: Array<{
      key: string;
      attrs: Record<string, string>;
      sku: string;
      price: number;
      onlinePrice?: number;
      codPrice?: number;
      stock: number;
      /** Legacy single image. Prefer `images`. */
      image?: string;
      /** Variant-specific gallery images; first image is treated as primary. */
      images?: string[];
    }>;
  };
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  cartLineId: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedVariant?: string;
  selectedSleeve?: string;
  customDesignFile?: string;
  customDesignName?: string;
  customProductType?: 'tshirt' | 'mug';
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  addresses?: {
    id: string;
    label: string;
    /** Contact at this address (required when saving). */
    recipientName?: string;
    recipientPhone?: string;
    address: string;
    city: string;
    state?: string;
    pincode: string;
    isDefault?: boolean;
  }[];
  mustResetPassword: boolean;
  createdAt?: string;
}

/** Persisted line item (API / admin). */
export interface OrderLineSnapshot {
  lineId?: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedVariant?: string;
  selectedSleeve?: string;
  customDesignUrl?: string;
  customDesignName?: string;
  customProductType?: string;
}

export interface Order {
  id: string;
  items: OrderLineSnapshot[];
  customer: CustomerInfo;
  userId?: string;
  status: 'pending' | 'packed' | 'shipped' | 'delivered';
  paymentMethod?: 'cod' | 'razorpay';
  paymentStatus?: 'unpaid' | 'paid' | 'failed';
  amountDue?: number;
  amountPaid?: number;
  paidAt?: string;
  paymentFailureReason?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  subtotal: number;
  total: number;
  discount: number;
  couponCode?: string;
  createdAt: string;
  updatedAt?: string;
  hasCustomPrint: boolean;
  emailError?: string;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state?: string;
  pincode: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'flat';
  value: number;
  minOrder: number;
  isActive: boolean;
  // Optional richer rules (server-driven)
  maxDiscount?: number;
  scope?: 'cart' | 'products' | 'categories';
  productIds?: string[];
  categoryIds?: string[];
  startAt?: string;
  endAt?: string;
  usageTotalLimit?: number;
  usagePerUserLimit?: number;
  newUsersOnly?: boolean;
  allowedUserGroups?: string[];
}

export type OrderStatus = Order['status'];
// ProductCategory already defined above as a type alias
