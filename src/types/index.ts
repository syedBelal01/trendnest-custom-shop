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
  /** Manual ordering within a category (lower comes first). */
  displayOrder?: number;
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
      /** True when this variant should be selected by default. */
      isDefault?: boolean;
      sku: string;
      price: number;
      /** Optional MRP / cut price for this variant (overrides product originalPrice). */
      originalPrice?: number;
      onlinePrice?: number;
      codPrice?: number;
      stock: number;
      /** Legacy single image. Prefer `images`. */
      image?: string;
      /** Variant-specific gallery images; first image is treated as primary. */
      images?: string[];
    }>;
  };

  // Internal-only shipping attributes (not intended for customer UI).
  shipWeightKg?: number;
  shipLengthCm?: number;
  shipWidthCm?: number;
  shipHeightCm?: number;
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
export type ReturnRequestStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'picked_up'
  | 'received'
  | 'refunded';

export interface ReturnRequestLine {
  lineId: string;
  quantity: number;
}

export interface ReturnRequestTimelineEntry {
  at?: string;
  action: string;
  actor?: string;
  note?: string;
}

export interface OrderReturnRefund {
  kind?: 'razorpay' | 'manual' | 'store_credit';
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  amount?: number;
  currency?: string;
  razorpayRefundId?: string;
  razorpayPaymentId?: string;
  error?: string;
  processedAt?: string;
}

export interface OrderReturnReverseShipment {
  source?: 'manual' | 'shiprocket';
  awb?: string;
  courierName?: string;
  shipmentId?: number;
  provider?: string;
  timeline?: Array<Record<string, unknown> & { at?: string }>;
  webhookDedupeKeys?: string[];
}

export interface OrderReturnRequest {
  returnId: string;
  status: ReturnRequestStatus;
  scope: 'full' | 'partial';
  lines: ReturnRequestLine[];
  reason: string;
  images: string[];
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  pickedUpAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
  reverseShipment?: OrderReturnReverseShipment;
  refund?: OrderReturnRefund;
  timeline?: ReturnRequestTimelineEntry[];
}

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
  status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
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
  /** Merchandise after discount (before shipping), when stored by the server. */
  goodsTotal?: number;
  shippingCharge?: number;
  /** Admin-only: real Shiprocket shipping cost (hidden from customers). */
  actualShippingCharge?: number;
  freeShippingApplied?: boolean;
  discount: number;
  couponCode?: string;
  createdAt: string;
  updatedAt?: string;
  hasCustomPrint: boolean;
  emailError?: string;
  /** Admin: shipping/manual/retry/quote attention needed. */
  needsShippingReview?: boolean;
  /** Admin: shipping balance or prepaid top-up due. */
  paymentPending?: boolean;
  shipping?: {
    provider?: string;
    /** Relaxed checkout: shipping row not yet confirmed against Shiprocket. */
    estimated?: boolean;
    finalized?: boolean;
    quoteRecalcAt?: string;
    quoteRecalcError?: string;
    pricingPendingReview?: boolean;
    balanceDueShipping?: number;
    shiprocketOrderId?: string;
    shipmentId?: number;
    awb?: string;
    courierId?: number;
    courierName?: string;
    estimatedDeliveryDate?: string;
    trackingStatus?: string;
    manualRequired?: boolean;
    manualReason?: string;
    error?: string;
    timeline?: Array<{
      at: string;
      kind: string;
      status?: string;
      awb?: string;
      courierName?: string;
      error?: string;
      source?: string;
      [k: string]: any;
    }>;
    rto?: { status?: string; updatedAt?: string };
    cancelledAt?: string;
    [k: string]: any;
  };
  /** Customer return / refund requests (embedded on order). */
  returnRequests?: OrderReturnRequest[];
  cancelledAt?: string;
  cancellationReason?: string;
  /** Timestamp when order was marked delivered. */
  deliveredAt?: string;
  cancellationRefund?: {
    kind?: 'razorpay' | 'none';
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    amount?: number;
    currency?: string;
    razorpayRefundId?: string;
    razorpayPaymentId?: string;
    error?: string;
    processedAt?: string;
  };
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
  /** Optional: only applies when cart has at least one matching SKU. Empty/undefined → applies to all products. */
  applicableSkus?: string[];
  startAt?: string;
  endAt?: string;
  usageTotalLimit?: number;
  usagePerUserLimit?: number;
  newUsersOnly?: boolean;
  allowedUserGroups?: string[];
}

export type OrderStatus = Order['status'];
// ProductCategory already defined above as a type alias
