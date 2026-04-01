/** Color/finish (etc.) with its own image set for PDP gallery. */
export interface ProductVariantOption {
  name: string;
  images: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: 'fashion' | 'home' | 'printed' | 'trending';
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
  status: 'pending' | 'packed' | 'shipped' | 'delivered';
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
  pincode: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'flat' | 'free_delivery';
  value: number;
  minOrder: number;
  isActive: boolean;
  expiresAt: string;
}

export type OrderStatus = Order['status'];
export type ProductCategory = Product['category'];
